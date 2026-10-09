$content = Get-Content -Path 'C:\D\Code\Code\2026\20261009_Franstant\index.html' -Raw -Encoding UTF8

# Fix Author name
$content = $content -replace '黄健', 'Jian Huang'

# Fix the internal double quotes in Section 2.1 that broke HTML previously
$content = $content -replace '表示"一些"', "表示 '一些'"
$content = $content -replace '表示"……的"', "表示 '……的'"

# Regex to match c="...", f="...", r="..."
# Using a non-greedy match to grab the attribute value
$pattern = '(?s)([cfr]=")(.*?)("(?=\s*(?:[cfr]="|>|\/>)))'

$newContent = [regex]::Replace($content, $pattern, {
    param($match)
    $prefix = $match.Groups[1].Value
    $attrVal = $match.Groups[2].Value
    $suffix = $match.Groups[3].Value
    
    # Escape HTML tags inside the attribute value
    $attrVal = $attrVal -replace '<', '&lt;'
    $attrVal = $attrVal -replace '>', '&gt;'
    
    return "$prefix$attrVal$suffix"
})

Set-Content -Path 'C:\D\Code\Code\2026\20261009_Franstant\index.html' -Value $newContent -Encoding UTF8
