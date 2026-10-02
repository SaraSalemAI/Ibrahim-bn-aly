import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1366,'height':900},accept_downloads=True)
        await ctx.add_init_script("try{localStorage.setItem('cm_tour','1');sessionStorage.setItem('cm_splash','1')}catch(e){}")
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/build/out.html#curriculum'); await pg.wait_for_timeout(900)
        await pg.click('.cmod li .ck'); await pg.wait_for_timeout(200); await pg.screenshot(path='v1.png')
        await pg.click('[data-cv="view:timeline"]'); await pg.wait_for_timeout(200); await pg.screenshot(path='v2.png')
        await pg.click('[data-cv="view:table"]'); await pg.wait_for_timeout(200)
        await pg.evaluate("location.hash='register'"); await pg.wait_for_timeout(200); await pg.click('[data-rggo=sample]'); await pg.wait_for_timeout(200)
        await pg.fill('[data-rg=name]','Credit memo drafting'); await pg.check('[data-rgq=people]'); await pg.wait_for_timeout(150); await pg.click('[data-rggo=save]'); await pg.wait_for_timeout(200); await pg.screenshot(path='v3.png')
        async with pg.expect_download() as d: await pg.click('[data-rgx=csv]')
        dl=await d.value
        for h in ['home','print/ar','day/9/9.4']:
            await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(250)
        print(errs, dl.suggested_filename, await pg.evaluate("ST.reg.length"))
        await b.close()
asyncio.run(main())
