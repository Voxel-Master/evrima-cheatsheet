import asyncio, os
from playwright.async_api import async_playwright

async def main():
  root = os.getcwd()
  index = f"http://localhost:5500"
  async with async_playwright() as p:
    browser = await p.chromium.launch()
    page = await browser.new_page(color_scheme="light")
    await page.emulate_media(media="print", color_scheme="light")
    await page.goto(index, wait_until="networkidle")
    await page.pdf(path=os.path.join(root, "cheatsheet.pdf"), prefer_css_page_size=True)
    await browser.close()

asyncio.run(main())
