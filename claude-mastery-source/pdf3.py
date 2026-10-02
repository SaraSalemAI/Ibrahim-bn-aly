import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        for route,name in [('printmp/ar','Master-Prompt-Book-AR.pdf'),('printmp/en','Master-Prompt-Book-EN.pdf')]:
            pg=await b.new_page(); await pg.goto('file:///home/claude/build/out.html#'+route); await pg.wait_for_timeout(1500); await pg.evaluate("document.fonts.ready"); await pg.emulate_media(media='print')
            await pg.pdf(path='/home/claude/build/'+name,format='A4',print_background=True,margin={'top':'14mm','bottom':'16mm','left':'12mm','right':'12mm'},display_header_footer=True,header_template='<div></div>',footer_template='<div style="font-size:8px;width:100%;text-align:center;color:#888">Claude Mastery — Dr. Sara Salem · <span class="pageNumber"></span>/<span class="totalPages"></span></div>'); await pg.close()
        await b.close()
asyncio.run(main())
