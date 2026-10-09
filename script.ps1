$content = Get-Content -Path 'C:\D\Code\Code\2026\20261009_Franstant\index.html' -Raw -Encoding UTF8

# Regex to match c="...", f="...", r="..."
$pattern = '([cfr]=")([^"]*)(")'

$newContent = [regex]::Replace($content, $pattern, {
    param($match)
    $prefix = $match.Groups[1].Value
    $attrVal = $match.Groups[2].Value
    $suffix = $match.Groups[3].Value
    
    # Replace <br/> with a space
    $attrVal = [regex]::Replace($attrVal, '<br\s*/?>', ' ')
    # Remove all other HTML tags
    $attrVal = [regex]::Replace($attrVal, '<[^>]+>', '')
    
    return "$prefix$attrVal$suffix"
})

Set-Content -Path 'C:\D\Code\Code\2026\20261009_Franstant\index.html' -Value $newContent -Encoding UTF8
