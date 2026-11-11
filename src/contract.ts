import { jsPDF } from 'jspdf';
import { money, type View } from './api';
export function contractPdf(v: View) {
  const { deal, milestones: ms, events } = v; const doc = new jsPDF({ unit: 'pt', format: 'letter' }); let y = 65;
  const ascii = (t: string) => t.replace(/[·•]/g, '-').replace(/[“”]/g,'"').replace(/[’]/g,"'").replace(/[–—]/g,'-').replace(/[^\x20-\x7E\n]/g,'');
  const line = (text: string, size = 10, bold = false, gap = 5) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
    for (const t of doc.splitTextToSize(ascii(text), 493)) { if (y > 735) { doc.addPage(); y = 60; } doc.text(t, 56, y); y += size + gap; }
  };
  doc.setFillColor(23,53,47); doc.rect(0,0,612,38,'F'); doc.setTextColor(255,255,255); doc.setFontSize(11); doc.text('ESCROWPAL / SANDBOX MILESTONE AGREEMENT',56,24); doc.setTextColor(23,53,47);
  line(deal.title,20,true,9); line('Deal '+deal.id+' | Created '+new Date(deal.createdAt).toLocaleDateString()+' | '+deal.status,9);
  y+=12;line('Parties',12,true);line('Buyer: '+deal.buyerName);line('Seller: '+deal.sellerName);
  if(deal.market){y+=12;line('Market analysis context',12,true);line('Selected pilot: '+deal.market.selectedCandidate,10,true);line('Analysis SHA-256: '+deal.market.sha256,8);line('Model preference reviewed by the buyer. No payment was authorized by the model.',9);}
  y+=12;line('Agreed scope',12,true);line(deal.description);
  y+=12;line('Milestones / '+money(deal.total)+' USD total',12,true);
  for (const [i,m] of ms.entries()) {line((i+1)+'. '+m.title+' / '+money(m.amount)+' / '+m.status,11,true);for(const c of m.criteria)line('- '+c,9);if(m.dueDate)line('Delivery target: '+m.dueDate,9);y+=6;}
  y+=8;line('Decision and payment terms',12,true);
  for(const term of [
    'This is a PayPal sandbox hackathon prototype, not a licensed escrow service. Explicit demo holds are simulated ledger entries. No real-world funds move in the demo.',
    'The seller must accept the plan before the buyer can authorize funding. A capture requires explicit buyer approval or both parties accepting the exact same mediated proposal.',
    'The review target is '+deal.inspectionDays+' days after submission. A missed target marks an overdue review; there is no automatic payment release.',
    'Advisory reviews compare written delivery claims with criteria. File contents and linked work are not inspected. Each party must independently inspect the actual work.',
    'A final capture credits the configured PayPal sandbox merchant. Seller payouts are not implemented. A partial capture leaves the remaining authorized amount uncaptured; this is not a refund of a previously captured payment.',
    'Real sandbox authorizations can expire or become uncollectible under PayPal rules. Prototype state alone is not proof of a successful capture. Uncertain payment results need reconciliation.',
    'Buyer acceptance recorded: '+(deal.buyerSignedAt?new Date(deal.buyerSignedAt).toLocaleString():'not recorded')+'. Seller acceptance recorded: '+(deal.sellerSignedAt?new Date(deal.sellerSignedAt).toLocaleString():'not recorded')+'.'
  ])line('- '+term,9);
  y+=14;line('Recent activity / newest 200 records at most',12,true);
  for(const e of [...events].reverse())line(new Date(e.createdAt).toLocaleString()+' ['+e.role+'] '+e.message,8,false,4);
  y+=12;line('Export the evidence receipt for the full activity history and a SHA-256 digest. A digest checks export integrity, not the truth of delivery claims. This document is a prototype record, not legal advice.',8);
  const pages=doc.getNumberOfPages();for(let p=1;p<=pages;p++){doc.setPage(p);doc.setFontSize(8);doc.setTextColor(110,125,100);doc.text('EscrowPal - sandbox prototype',56,765);doc.text(p+' / '+pages,520,765);}
  doc.save('escrowpal-'+deal.id+'-agreement.pdf');
}
