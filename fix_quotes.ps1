$content = Get-Content -Path 'C:\D\Code\Code\2026\20261009_Franstant\index.html' -Raw -Encoding UTF8

$content = $content -replace '商量说："来吧！我们要做砖，把砖烧透了。"', "商量说：'来吧！我们要做砖，把砖烧透了。'"
$content = $content -replace '他们说："来吧！我们要建造一座城和一座塔，塔顶通天，为要传扬我们的名，免得我们分散在全地上。""', "他们说：'来吧！我们要建造一座城和一座塔，塔顶通天，为要传扬我们的名，免得我们分散在全地上。'"
$content = $content -replace '耶和华说："看哪，他们成为一样的人民，都是一样的言语，如今既做起这事来，以后他们所要做的事就没有不成就的了。"', "耶和华说：'看哪，他们成为一样的人民，都是一样的言语，如今既做起这事来，以后他们所要做的事就没有不成就的了。'"
$content = $content -replace '我们下去，在那里变乱他们的口音，使他们的言语彼此不通。""', "我们下去，在那里变乱他们的口音，使他们的言语彼此不通。'"

Set-Content -Path 'C:\D\Code\Code\2026\20261009_Franstant\index.html' -Value $content -Encoding UTF8
