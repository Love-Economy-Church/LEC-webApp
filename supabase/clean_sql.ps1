$content = Get-Content "migration.sql"
$sqlContent = $content | Select-Object -Skip 3
$finalContent = @()
foreach ($line in $sqlContent) {
    if ($line.Trim() -eq '```') { break }
    $finalContent += $line
}
$finalContent | Set-Content "migration.sql" -Encoding UTF8
