import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1366,'height':900},accept_downloads=True)
        await ctx.add_init_script("try{localStorage.setItem('cm_tour','1');sessionStorage.setItem('cm_splash','1')}catch(e){}")
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/build/out.html'); await pg.wait_for_timeout(800); await pg.screenshot(path='x0.png')
        await pg.evaluate("location.hash='lab'"); await pg.wait_for_timeout(300)
        await pg.click('[data-lfc=agent]'); await pg.wait_for_timeout(200); n1=await pg.evaluate("document.querySelectorAll('#view details.case').length")
        await pg.select_option('#lff','Sales'); await pg.wait_for_timeout(200); n2=await pg.evaluate("document.querySelectorAll('#view details.case').length")
        await pg.select_option('#lff','all'); await pg.click('[data-lfc=design]'); await pg.wait_for_timeout(200); await pg.click('#view details.case summary'); await pg.wait_for_timeout(200); await pg.screenshot(path='x1.png')
        await pg.click('[data-labtab=studio]'); await pg.wait_for_timeout(300); t=await pg.evaluate("labTab"); await pg.click('[data-stutab=battle]'); await pg.wait_for_timeout(200); t2=await pg.evaluate("labTab+'/'+stuTab")
        await pg.click('[data-labtab=cases]'); await pg.wait_for_timeout(200); t3=await pg.evaluate("labTab")
        await pg.evaluate("location.hash='studio'"); await pg.wait_for_timeout(300); t4=await pg.evaluate("labTab+' '+location.hash")
        await pg.evaluate("location.hash='acct'"); await pg.wait_for_timeout(200); await pg.click('[data-acct=claude]'); await pg.wait_for_timeout(500)
        await pg.fill('#lgname','Sara Salem'); await pg.fill('#lgemail','sara@example.com'); await pg.click('[data-acct=email]'); await pg.wait_for_timeout(300)
        await pg.fill('#sendto','trainer@example.com'); await pg.press('#sendto','Tab'); await pg.wait_for_timeout(300); await pg.screenshot(path='x2.png')
        href=await pg.evaluate("[...document.querySelectorAll('a.tbtn')].map(a=>a.href.slice(0,60))")
        for h in ['home','curriculum','agentb','policy','cert','print/ar','skills','cases']:
            await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(200)
        print(errs,n1,n2,t,t2,t3,t4,href[:2], await pg.evaluate("LAB.length"))
        await b.close()
asyncio.run(main())
