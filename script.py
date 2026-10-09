import re

with open(r'C:\D\Code\Code\2026\20261009_Franstant\index.html', 'r', encoding='utf-8') as f:
    content = f.read()

def replacer(match):
    # This function is called for every c="...", f="...", r="..."
    attr_val = match.group(2)
    # Replace <br/> with a space or something
    attr_val = re.sub(r'<br\s*/?>', ' ', attr_val)
    # Remove all other HTML tags
    attr_val = re.sub(r'<[^>]+>', '', attr_val)
    return f'{match.group(1)}"{attr_val}"'

# Match c="...", f="...", r="..."
new_content = re.sub(r'([cfr]=)"([^"]*)"', replacer, content)

with open(r'C:\D\Code\Code\2026\20261009_Franstant\index.html', 'w', encoding='utf-8') as f:
    f.write(new_content)
