import { chromium,expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
await mkdir('test-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,reducedMotion:'reduce'});
const page=await context.newPage();page.setDefaultTimeout(20000);
const report={checks:[],models:[],errors:[]};page.on('pageerror',e=>report.errors.push(e.message));
const mark=t=>{report.checks.push(t);console.log('PASS '+t);};
function response(action){return page.waitForResponse(r=>{try{return r.url().endsWith('/api/rpc')&&r.request().postDataJSON().action===action;}catch{return false;}},{timeout:90000});}
async function result(action,click){const p=response(action);await click();const r=await p;assert.equal(r.status(),200,action+' returned an error');return r.json();}
async function confirm(name){await page.getByRole('dialog').getByRole('button',{name,exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();}
async function switchRole(role){await page.getByRole('button',{name:role+' view',exact:true}).click();await expect(page.getByText(role+' view',{exact:false}).first()).toBeVisible();await expect(page.locator('.room-heading')).toContainText(role+' view',{ignoreCase:true});}
async function overflow(width,label){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,label+' overflows '+width);mark(label+' fits '+width+'px');}
try{
 await page.goto('http://127.0.0.1:4173');await page.getByRole('button',{name:'Explore the live demo'}).click();await page.getByRole('heading',{name:'Sweet Crumb · website launch'}).waitFor();
 await page.evaluate(()=>document.fonts.ready);
 const initial=await page.evaluate(()=>JSON.parse(localStorage.getItem('ep_deals')));
 await writeFile('/tmp/escrowpal-browser-private.json',JSON.stringify({links:initial}));
 const first=page.locator('.milestone-card').nth(0);
 await first.getByRole('button',{name:'Settle at 33%'}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.getByText('$99.00',{exact:true})).toBeVisible();await expect(dialog.getByText('$201.00',{exact:true})).toBeVisible();
 for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('dialog')),true,'Focus escaped modal');}
 await page.screenshot({path:'test-results/settlement-confirmation.png',fullPage:false});
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(first).toContainText('Ready for review');mark('Confirmation shows exact split, contains keyboard focus, and Escape cancels without settlement');
 await first.getByRole('button',{name:'Request changes',exact:true}).click();await dialog.getByRole('textbox',{name:'Requested changes'}).fill('Please add mobile layouts and a review link.');
 await result('revise',()=>dialog.getByRole('button',{name:'Request changes',exact:true}).click());await expect(dialog).not.toBeVisible();await expect(first).toContainText('Authorized');mark('Buyer requests changes without releasing the hold');
 await switchRole('Seller');
 await first.getByRole('button',{name:/Fill a fictional complete delivery/}).click();
 await first.locator('input[type=file]').setInputFiles({name:'fictional-proof.txt',mimeType:'text/plain',buffer:Buffer.from('Fictional proof attachment for the demo. Inspect actual work independently.')});
 let started=Date.now();const reviewed=await result('submit',()=>first.getByRole('button',{name:'Submit for advisory review'}).click());
 report.models.push({action:'review',elapsedSeconds:(Date.now()-started)/1000,engine:reviewed.milestones[0].verdict.engine,verdict:reviewed.milestones[0].verdict});
 await expect(first).toContainText('Ready for review');mark('Seller submits delivery and attachment, with the actual review engine identified');
 await page.screenshot({path:'test-results/reviewed-deal.png',fullPage:true});
 await switchRole('Buyer');await first.getByRole('button',{name:'Approve $300.00',exact:true}).click();await confirm('Confirm demo settlement');await expect(first).toContainText('$300.00 simulated capture recorded');mark('Buyer explicitly settles the first milestone');
 const second=page.locator('.milestone-card').nth(1);await second.getByRole('button',{name:'Discuss a dispute'}).click();await dialog.getByRole('textbox',{name:'What is in dispute?'}).fill('Fictional disagreement: site and order form described, but the repository handoff is missing.');
 await result('dispute',()=>dialog.getByRole('button',{name:'Open a dispute',exact:true}).click());await expect(dialog).not.toBeVisible();
 await switchRole('Seller');await second.getByRole('textbox',{name:'Add your perspective'}).fill('Fictional response: responsive site and order form are described. Repository access is not delivered yet. I suggest a partial settlement.');
 started=Date.now();const mediated=await result('respond',()=>second.getByRole('button',{name:'Update proposal'}).click());
 const proposal=mediated.disputes.find(d=>d.milestoneId===mediated.milestones[1].id);
 report.models.push({action:'mediation',elapsedSeconds:(Date.now()-started)/1000,engine:proposal.mediator.engine,proposal:proposal.mediator});await expect(second).toContainText('Suggested resolution');mark('Both positions produce a versioned, non-binding advisory proposal');
 const axe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();report.disputeAccessibility=axe.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length}));assert.equal(axe.violations.length,0,'Accessibility violations on the dispute screen');
 await page.screenshot({path:'test-results/dispute-proposal.png',fullPage:true});
 await second.getByRole('button',{name:'Accept this proposal',exact:true}).click();await dialog.getByRole('button',{name:/Accept \d+% proposal/}).click();await expect(dialog).not.toBeVisible();await expect(second).toContainText('You accepted');await expect(second).toContainText('In discussion');mark('One acceptance leaves the authorization unsettled');
 await switchRole('Buyer');await second.getByRole('button',{name:'Accept this proposal',exact:true}).click();await dialog.getByRole('button',{name:/Accept \d+% proposal/}).click();await expect(dialog).not.toBeVisible();await expect(second).toContainText('Settled by mutual acceptance');mark('Both parties accepting the same proposal finalizes the simulated split');
 await switchRole('Seller');const third=page.locator('.milestone-card').nth(2);await third.getByRole('button',{name:/Fill a fictional complete delivery/}).click();
 await result('submit',()=>third.getByRole('button',{name:'Submit for advisory review'}).click());await switchRole('Buyer');await third.getByRole('button',{name:'Approve $300.00',exact:true}).click();await confirm('Confirm demo settlement');await expect(page.locator('.room-parties')).toContainText('completed');mark('All three milestones can complete through the real interface');
 const pdfPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Agreement PDF'}).click();const pdf=await pdfPromise;await pdf.saveAs('test-results/sample-agreement.pdf');assert.equal((await readFile('test-results/sample-agreement.pdf')).subarray(0,5).toString(),'%PDF-');mark('Agreement PDF downloads successfully');
 const receiptPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Evidence receipt'}).click();const receipt=await receiptPromise;await receipt.saveAs('test-results/sample-evidence.json');const j=JSON.parse(await readFile('test-results/sample-evidence.json','utf8'));assert.equal(j.sha256,createHash('sha256').update(JSON.stringify(j.payload)).digest('hex'));assert.equal(j.payload.deal.status,'completed');mark('Evidence receipt digest verifies and includes the completed ledger');
 await page.goto('http://127.0.0.1:4173/new');await page.getByRole('button',{name:/Use the fictional bakery/}).click();
 started=Date.now();const plan=await result('preview',()=>page.getByRole('button',{name:'Draft an editable plan'}).click());report.models.push({action:'planning',elapsedSeconds:(Date.now()-started)/1000,engine:plan.engine,total:plan.total,milestones:plan.milestones});
 await expect(page.getByRole('heading',{name:'Make this plan yours.'})).toBeVisible();await expect(page.getByRole('button',{name:'Sign as buyer & create agreement'})).toBeDisabled();
 await page.getByRole('textbox',{name:'Agreement title'}).fill('Bakery launch · walkthrough agreement');
 for(const width of [375,768,1440])await overflow(width,'Editable plan');
 await page.screenshot({path:'test-results/editable-plan.png',fullPage:true});
 const planAxe=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();report.planAccessibility=planAxe.violations.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length}));assert.equal(planAxe.violations.length,0,'Accessibility violations on plan review');
 await page.getByRole('checkbox').check();const made=await result('create',()=>page.getByRole('button',{name:'Sign as buyer & create agreement'}).click());await expect(page.getByRole('heading',{name:/Next, bring your/})).toBeVisible();assert.match(await page.getByRole('textbox',{name:/Send this link only/}).inputValue(),/\/d\/.+\?k=/);mark('Creation requires reviewed terms and produces a private seller invitation');
 await page.getByRole('button',{name:'Open my buyer workspace'}).click();await expect(page.getByRole('heading',{name:'Ready for the other signature.'})).toBeVisible();await expect(page.getByRole('button',{name:'Use a demo hold'})).toHaveCount(0);
 await page.goto('http://127.0.0.1:4173/d/'+made.id+'?k='+made.sellerToken);await page.getByRole('button',{name:'Accept the terms'}).click();await confirm('Accept terms as seller');await expect(page.locator('.room-parties')).toContainText('active');mark('Seller explicitly signs before funding is offered');
 await writeFile('/tmp/escrowpal-persistence-private.json',JSON.stringify({id:made.id,k:made.buyerToken,title:'Bakery launch · walkthrough agreement'}));
 assert.deepEqual(report.errors,[]);report.passed=true;
} catch(e){report.passed=false;report.failure=String(e);await page.screenshot({path:'test-results/workflow-failure.png',fullPage:true}).catch(()=>{});console.error(e);process.exitCode=1;}
finally{await writeFile('test-results/browser-workflow.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,models:report.models.map(m=>({action:m.action,engine:m.engine,elapsedSeconds:m.elapsedSeconds})),failure:report.failure}));}
