<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>RSS · <xsl:value-of select="/rss/channel/title"/></title>
        <style>
          body { margin: 0; color: #171a1d; background: #f5f2eb; font: 16px/1.7 "Aptos","Segoe UI","Helvetica Neue","PingFang SC","Noto Sans CJK SC",sans-serif; }
          main { width: min(720px, calc(100vw - 48px)); margin: 0 auto; padding: 56px 0; }
          .kicker { margin: 0 0 10px; color: #3159d9; font-size: 12px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
          h1 { margin: 0 0 12px; font: 500 44px/1 "Iowan Old Style","Palatino Linotype",Georgia,serif; letter-spacing: -.04em; }
          .box { margin: 24px 0 40px; padding: 16px 20px; background: #fffdf8; border: 1px solid rgba(23,26,29,.14); border-radius: 16px; }
          code { display: block; margin-top: 8px; padding: 10px 12px; background: rgba(23,26,29,.05); border-radius: 8px; font: 14px "SF Mono",Menlo,monospace; word-break: break-all; }
          ol { margin: 0; padding: 0; list-style: none; }
          li { padding: 14px 0; border-top: 1px solid rgba(23,26,29,.14); }
          li a { color: inherit; font-weight: 700; text-decoration: none; }
          li a:hover { color: #3159d9; }
          .date { color: #7b8288; font-size: 13px; }
          .back { color: #4e555c; font-weight: 700; text-decoration: none; }
        </style>
      </head>
      <body>
        <main>
          <p class="kicker">RSS feed</p>
          <h1><xsl:value-of select="/rss/channel/title"/></h1>
          <div class="box">
            这是 RSS 订阅地址。把下面的网址复制到 RSS 阅读器里，就能收到新文章。
            <code>https://kirisawa-subaru.github.io/rss.xml</code>
          </div>
          <ol>
            <xsl:for-each select="/rss/channel/item">
              <li>
                <a href="{link}"><xsl:value-of select="title"/></a>
                <div class="date"><xsl:value-of select="substring(pubDate, 6, 11)"/></div>
              </li>
            </xsl:for-each>
          </ol>
          <p><a class="back" href="/">← 回到博客</a></p>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
