import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1366,'height':900},accept_downloads=True)
        await ctx.add_init_script("try{localStorage.setItem('cm_tour','1');sessionStorage.setItem('cm_splash','1')}catch(e){}")
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/build/out.html'); await pg.wait_for_timeout(900); await pg.screenshot(path='u1.png')
        for h in ['studio','builder','agentb','roi','ready','wb','day/1/1.1','lab','map','export','skills','cases','deep/agentbuild','about','print/ar']:
            await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(200)
        await pg.evaluate("location.hash='agentb'"); await pg.wait_for_timeout(200); await pg.click('[data-abtpl=finance]'); await pg.wait_for_timeout(200); await pg.click('[data-about=cc]'); await pg.wait_for_timeout(200); await pg.screenshot(path='u2.png')
        async with pg.expect_download() as d: await pg.click('[data-abexp=zip]')
        z=await d.value
        await pg.evaluate("location.hash='studio'"); await pg.wait_for_timeout(200); await pg.click('[data-stutab=battle]'); await pg.wait_for_timeout(200); await pg.fill('[data-bat=b]','write a report'); await pg.click('[data-stugo=judge]'); await pg.wait_for_timeout(300); await pg.screenshot(path='u3.png')
        await pg.evaluate("location.hash='ready'"); await pg.wait_for_timeout(200)
        for i in range(10): await pg.click(f'[data-ra="{i}:{i%3}"]'); await pg.wait_for_timeout(40)
        await pg.screenshot(path='u4.png')
        await pg.evaluate("location.hash='day/1/1.1'"); await pg.wait_for_timeout(200); await pg.click('[data-bm]'); await pg.fill('[data-note]','my note'); await pg.evaluate("location.hash='wb'"); await pg.wait_for_timeout(200)
        n=await pg.evaluate("document.querySelectorAll('#view .case').length")
        print(errs,z.suggested_filename,n)
        await b.close()
asyncio.run(main())
