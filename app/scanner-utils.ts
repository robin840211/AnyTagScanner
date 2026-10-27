export function isSafeWebUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function paginateScanText(value: string, compact: boolean): string[] {
  const columns = compact ? 18 : 14;
  const maxLines = compact ? 3 : 10;
  const pages: string[] = [];
  let page = '', column = 0, line = 1;
  for (const character of Array.from(value.replace(/\r\n?/g, '\n'))) {
    const width = character === '\t' ? 4 : 1;
    const newline = character === '\n';
    const wrap = !newline && column + width > columns;
    if ((newline || wrap) && line === maxLines) {
      pages.push(page); page = ''; column = 0; line = 1;
      if (newline) continue;
    } else if (newline || wrap) {
      line++; column = 0;
    }
    page += character;
    if (!newline) column += width;
  }
  if (page || !pages.length) pages.push(page);
  return pages;
}
