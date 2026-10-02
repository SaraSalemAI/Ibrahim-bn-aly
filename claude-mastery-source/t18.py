import asyncio,json,os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={'width':1366,'height':900},accept_downloads=True)
        await ctx.add_init_script("try{localStorage.setItem('cm_tour','1');sessionStorage.setItem('cm_splash','1')}catch(e){}")
        pg=await ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file:///home/claude/build/out.html'); await pg.wait_for_timeout(800)
        res=[]
        for h in ['csim','card','cohort','policy','wf','mcpp','packs','glossary','skills','curriculum','home','print/ar']:
            await pg.evaluate(f"location.hash='{h}'"); await pg.wait_for_timeout(250)
        # sim
        await pg.evaluate("location.hash='csim'"); await pg.wait_for_timeout(200)
        for i in [0,0,0]: await pg.click(f'[data-cs="pick:{i}"]'); await pg.wait_for_timeout(120)
        await pg.screenshot(path='w1.png'); res.append(await pg.evaluate("CSS_.node+':'+CSS_.pts"))
        # card
        await pg.evaluate("location.hash='card'"); await pg.wait_for_timeout(200); await pg.fill('#cname','Sara Salem')
        async with pg.expect_download() as d: await pg.click('[data-cardgo=png]')
        dl=await d.value; await dl.save_as('/home/claude/build/card.png'); res.append(dl.suggested_filename)
        # cheat
        await pg.evaluate("location.hash='day/1'"); await pg.wait_for_timeout(250)
        async with pg.expect_download(timeout=90000) as d: await pg.click('[data-cheat="1"]')
        dl=await d.value; await dl.save_as('/home/claude/build/cheat.pdf'); res.append(dl.suggested_filename)
        # cohort export & import
        await pg.evaluate("location.hash='cohort'"); await pg.wait_for_timeout(200)
        async with pg.expect_download() as d: await pg.click('[data-coh=export]')
        dl=await d.value; path='/home/claude/build/prog.json'; await dl.save_as(path)
        await pg.set_input_files('#cohfile',path); await pg.wait_for_timeout(300); res.append(await pg.evaluate("COH.length"))
        # policy, wf, mcpp exports
        await pg.evaluate("location.hash='policy'"); await pg.wait_for_timeout(200); await pg.fill('[data-pol=org]','Nile Trade'); 
        async with pg.expect_download() as d: await pg.click('[data-polx=md]')
        res.append((await d.value).suggested_filename)
        await pg.evaluate("location.hash='mcpp'"); await pg.wait_for_timeout(200); await pg.check('[data-mpo=draft]'); await pg.wait_for_timeout(200)
        async with pg.expect_download() as d: await pg.click('[data-mpx=py]')
        await (await d.value).save_as('/home/claude/build/server.py')
        await pg.evaluate("location.hash='packs'"); await pg.wait_for_timeout(200)
        async with pg.expect_download() as d: await pg.click('[data-pack=lab]')
        pk='/home/claude/build/pack.json'; await (await d.value).save_as(pk)
        await pg.set_input_files('#packfile',pk); await pg.wait_for_timeout(300); res.append(await pg.evaluate("ST.mine.length"))
        await pg.evaluate("location.hash='glossary'"); await pg.wait_for_timeout(150); await pg.fill('#gq','token'); await pg.wait_for_timeout(150); res.append(await pg.evaluate("document.querySelectorAll('#view tr').length"))
        await pg.evaluate("location.hash='skills'"); await pg.wait_for_timeout(150); await pg.click('[data-skv=plugins]'); await pg.wait_for_timeout(150); await pg.screenshot(path='w2.png')
        await pg.evaluate("location.hash='wf'"); await pg.wait_for_timeout(200); await pg.screenshot(path='w3.png')
        print(errs,res)
        await b.close()
asyncio.run(main())
