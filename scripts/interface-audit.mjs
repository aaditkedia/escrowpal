import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir,writeFile } from 'node:fs/promises';
const out='test-results';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(15000);
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const report={pages:[],errors};
try{
 for(const width of [1440,768,375]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:4173');await page.evaluate(()=>document.fonts.ready);
  const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  report.pages.push({page:'landing',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),violations:axe.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,examples:v.nodes.slice(0,8).map(n=>({target:n.target,summary:n.failureSummary}))}))});
  await page.screenshot({path:out+'/landing-'+width+'.png',fullPage:true});
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto('http://127.0.0.1:4173/new');
 await page.getByRole('button',{name:/Use the fictional bakery/}).click();
 await page.screenshot({path:out+'/new-agreement.png',fullPage:true});
 const newAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
 report.pages.push({page:'new',width:1440,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),violations:newAxe.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,examples:v.nodes.slice(0,8).map(n=>({target:n.target,summary:n.failureSummary}))}))});
 await page.goto('http://127.0.0.1:4173');await page.getByRole('button',{name:'Explore the live demo'}).click();await page.getByRole('heading',{name:'Sweet Crumb · website launch'}).waitFor();
 for(const width of [1440,768,375]){
  await page.setViewportSize({width,height:1000});const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  report.pages.push({page:'room',width,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),violations:axe.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length,examples:v.nodes.slice(0,8).map(n=>({target:n.target,summary:n.failureSummary}))}))});
  await page.screenshot({path:out+'/deal-room-'+width+'.png',fullPage:true});
 }
}finally{await writeFile(out+'/interface-audit.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
