param([switch]$Import)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$config = Get-Content (Join-Path $projectRoot 'power.config.json') -Raw | ConvertFrom-Json
$workPath = Join-Path $projectRoot ('.power/csv-import/' + [guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $workPath -Force | Out-Null

$definitions = @(
    @{ Name = 'cr1b4_contact'; File = 'contact.csv'; Key = @('cr1b4_emailaddress'); Types = @{} },
    @{ Name = 'cr1b4_opportunityassessment'; File = 'cr1b4_opportunityassessment.csv'; Key = @('cr1b4_opportunityname', 'cr1b4_versionnumber'); Types = @{
        cr1b4_capturedon = 'datetime'; cr1b4_qualificationscore = 'number'; cr1b4_recommendation = 'optionsetvalue'; cr1b4_versionnumber = 'number'
    } },
    @{ Name = 'cr1b4_opportunitystakeholder'; File = 'cr1b4_opportunitystakeholder.csv'; Key = @('cr1b4_contactname', 'cr1b4_opportunityassessmentname', 'cr1b4_stakeholderrole'); Types = @{
        cr1b4_engagementstatus = 'optionsetvalue'; cr1b4_influencelevel = 'optionsetvalue'; cr1b4_lastengagementdate = 'datetime'; cr1b4_relationshipstance = 'optionsetvalue'; cr1b4_stakeholderrole = 'optionsetvalue'
    } },
    @{ Name = 'cr1b4_opportunityassessmentnote'; File = 'cr1b4_opportunityassessmentnote.csv'; Key = @('cr1b4_notetitle', 'cr1b4_opportunityassessmentid'); Types = @{
        cr1b4_internalnoteflag = 'bool'; cr1b4_notedate = 'datetime'; cr1b4_notetype = 'optionsetvalue'
    } }
)

$schema = [System.Xml.XmlDocument]::new()
$entities = $schema.CreateElement('entities')
$schema.AppendChild($entities) | Out-Null
foreach ($definition in $definitions) {
    $rows = @(Import-Csv (Join-Path $PSScriptRoot $definition.File))
    if (-not $rows.Count) { throw "Empty CSV: $($definition.File)" }
    $definition.Rows = $rows
    $entity = $schema.CreateElement('entity')
    $entity.SetAttribute('name', $definition.Name)
    $entity.SetAttribute('displayname', $definition.Name)
    $entity.SetAttribute('primaryidfield', $definition.Name + 'id')
    $entity.SetAttribute('primarynamefield', $definition.Key[0])
    $entity.SetAttribute('disableplugins', 'false')
    $fields = $schema.CreateElement('fields')
    foreach ($column in @($definition.Name + 'id') + @($rows[0].PSObject.Properties.Name)) {
        $field = $schema.CreateElement('field')
        $field.SetAttribute('name', $column)
        $field.SetAttribute('displayname', $column)
        $type = if ($column -eq $definition.Name + 'id') { 'guid' } elseif ($definition.Types.ContainsKey($column)) { $definition.Types[$column] } else { 'string' }
        $field.SetAttribute('type', $type)
        if ($column -eq $definition.Name + 'id') { $field.SetAttribute('primarykey', 'true') }
        $fields.AppendChild($field) | Out-Null
    }
    $entity.AppendChild($fields) | Out-Null
    $entity.AppendChild($schema.CreateElement('relationships')) | Out-Null
    $entities.AppendChild($entity) | Out-Null
}
$schemaPath = Join-Path $workPath 'schema.xml'
$schema.Save($schemaPath)
$existingPath = Join-Path $workPath 'existing.zip'
& pac data export --environment $config.environmentId --schemaFile $schemaPath --dataFile $existingPath
if ($LASTEXITCODE -ne 0) { throw 'Dataverse export failed; no import was attempted.' }
Expand-Archive -Path $existingPath -DestinationPath (Join-Path $workPath 'existing')

$choices = @{
    cr1b4_recommendation = @{ Pursue = '0'; 'Do Not Pursue' = '1' }
    cr1b4_engagementstatus = @{ Engaged = '0' }
    cr1b4_influencelevel = @{ High = '0' }
    cr1b4_relationshipstance = @{ Unknown = '0' }
    cr1b4_stakeholderrole = @{ 'Executive Sponsor' = '0'; 'Decision Maker' = '1' }
    cr1b4_notetype = @{ 'Customer Conversation' = '0'; Action = '1'; Risk = '2' }
}

function Get-RecordKey($values, $columns) {
    ConvertTo-Json -InputObject @($columns | ForEach-Object { ([string]$values[$_]).Trim().ToLowerInvariant() }) -Compress
}

function Get-ExportValues($record) {
    $values = @{}
    foreach ($field in $record.field) { $values[$field.name] = [System.Net.WebUtility]::HtmlDecode($field.value) }
    return $values
}

[xml]$existing = Get-Content (Join-Path $workPath 'existing/data.xml') -Raw
$data = [System.Xml.XmlDocument]::new()
$dataEntities = $data.CreateElement('entities')
$data.AppendChild($dataEntities) | Out-Null
$missingCount = 0
$expectedKeys = @{}
foreach ($definition in $definitions) {
    $known = [System.Collections.Generic.HashSet[string]]::new()
    $expectedKeys[$definition.Name] = [System.Collections.Generic.HashSet[string]]::new()
    $existingEntity = $existing.entities.entity | Where-Object { $_.name -eq $definition.Name }
    foreach ($record in $existingEntity.records.record) {
        if ($null -eq $record) { continue }
        $known.Add((Get-RecordKey (Get-ExportValues $record) $definition.Key)) | Out-Null
    }
    $entity = $data.CreateElement('entity')
    $entity.SetAttribute('name', $definition.Name)
    $entity.SetAttribute('displayname', $definition.Name)
    $records = $data.CreateElement('records')
    $skipped = 0
    foreach ($row in $definition.Rows) {
        $values = @{}
        foreach ($property in $row.PSObject.Properties) {
            $value = [string]$property.Value
            if (-not $value.Length) { continue }
            if ($choices.ContainsKey($property.Name)) {
                if (-not $choices[$property.Name].ContainsKey($value)) { throw "Unknown choice $($property.Name): $value" }
                $value = $choices[$property.Name][$value]
            } elseif ($definition.Types[$property.Name] -eq 'bool') {
                $value = ([bool]::Parse($value)).ToString()
            } elseif ($definition.Types[$property.Name] -eq 'number') {
                $value = ([int]::Parse($value, [System.Globalization.CultureInfo]::InvariantCulture)).ToString()
            }
            $values[$property.Name] = $value
        }
        $key = Get-RecordKey $values $definition.Key
        $expectedKeys[$definition.Name].Add($key) | Out-Null
        if ($known.Contains($key)) { $skipped++; continue }
        $hash = [System.Security.Cryptography.SHA256]::HashData([System.Text.Encoding]::UTF8.GetBytes($definition.Name + ':' + $key))
        $recordId = [guid]::new([byte[]]$hash[0..15]).ToString()
        $record = $data.CreateElement('record')
        $record.SetAttribute('id', $recordId)
        $values[$definition.Name + 'id'] = $recordId
        foreach ($column in $values.Keys) {
            $field = $data.CreateElement('field')
            $field.SetAttribute('name', $column)
            $field.SetAttribute('value', [System.Net.WebUtility]::HtmlEncode($values[$column]))
            $record.AppendChild($field) | Out-Null
        }
        $records.AppendChild($record) | Out-Null
        $known.Add($key) | Out-Null
        $missingCount++
    }
    $entity.AppendChild($records) | Out-Null
    $entity.AppendChild($data.CreateElement('m2mrelationships')) | Out-Null
    $dataEntities.AppendChild($entity) | Out-Null
    Write-Output "$($definition.Name): $($records.ChildNodes.Count) missing, $skipped already present"
}

$packagePath = Join-Path $workPath 'package'
New-Item -ItemType Directory -Path $packagePath | Out-Null
$data.Save((Join-Path $packagePath 'data.xml'))
Copy-Item (Join-Path $workPath 'existing/data_schema.xml') (Join-Path $packagePath 'data_schema.xml')
$packageZip = Join-Path $workPath 'missing-records.zip'
Compress-Archive -Path (Join-Path $packagePath '*') -DestinationPath $packageZip
Write-Output "Prepared $missingCount missing records in $packageZip"
if (-not $Import) { Write-Output 'Dry run only. Pass -Import to add the missing records.'; return }
if ($missingCount -eq 0) { Write-Output 'All CSV records already exist. No import needed.'; return }

& pac data import --environment $config.environmentId --data $packageZip --connection-count 1
if ($LASTEXITCODE -ne 0) { throw 'Import failed; inspect the CLI diagnostics before retrying.' }
$verifiedZip = Join-Path $workPath 'verified.zip'
& pac data export --environment $config.environmentId --schemaFile $schemaPath --dataFile $verifiedZip
if ($LASTEXITCODE -ne 0) { throw 'Post-import verification export failed.' }
Expand-Archive -Path $verifiedZip -DestinationPath (Join-Path $workPath 'verified')
[xml]$verified = Get-Content (Join-Path $workPath 'verified/data.xml') -Raw
foreach ($definition in $definitions) {
    $counts = @{}
    $entity = $verified.entities.entity | Where-Object { $_.name -eq $definition.Name }
    foreach ($record in $entity.records.record) {
        if ($null -eq $record) { continue }
        $key = Get-RecordKey (Get-ExportValues $record) $definition.Key
        $counts[$key] = 1 + $counts[$key]
    }
    foreach ($key in $expectedKeys[$definition.Name]) {
        if ($counts[$key] -ne 1) { throw "Expected exactly one CSV record for $($definition.Name): $key; found $($counts[$key])" }
    }
    Write-Output "Verified $($expectedKeys[$definition.Name].Count) CSV records in $($definition.Name)"
}