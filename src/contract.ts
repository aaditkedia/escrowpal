import { jsPDF } from 'jspdf';
import { money } from './api';
export function contractPdf(v: any) {
  const { deal, milestones: ms, events } = v; const doc = new jsPDF({ unit: 'pt', format: 'letter' }); let y = 60; const W = 500;
  const line = (t: string, size = 10, bold = false, gap = 4) => { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); for (const l of doc.splitTextToSize(t, W)) { if (y > 740) { doc.addPage(); y = 60; } doc.text(l, 56, y); y += size + gap; } };
  doc.setFillColor(20, 16, 14); doc.rect(0, 0, 612, 36, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(12); doc.text('ESCROWPAL · MILESTONE ESCROW AGREEMENT', 56, 23); doc.setTextColor(0, 0, 0);
  line(deal.title, 18, true, 8); line(`Deal ID ${deal.id} · created ${new Date(deal.createdAt).toLocaleDateString()} · status ${deal.status}`, 9);
  y += 6; line('Parties', 12, true); line(`Buyer: ${deal.buyerName}${deal.buyerEmail ? ' <' + deal.buyerEmail + '>' : ''}`); line(`Seller: ${deal.sellerName}${deal.sellerEmail ? ' <' + deal.sellerEmail + '>' : ''}`);
  y += 6; line('Scope (as described by the buyer)', 12, true); line(deal.description);
  y += 6; line(`Milestones · total ${money(deal.total)}`, 12, true);
  ms.forEach((m: any, i: number) => { line(`${i + 1}. ${m.title} · ${money(m.amount)}${m.dueDate ? ' · due ' + m.dueDate : ''} · ${m.status}`, 10, true); m.criteria.forEach((c: string) => line('   • ' + c, 9)); });
  y += 6; line('Terms', 12, true);
  [`Funds for each milestone are held as a PayPal authorization and captured only when the buyer approves the delivery or both parties accept a mediated split.`,
   `The buyer has ${deal.inspectionDays} days after a delivery to approve it, request changes or open a dispute. After that window the milestone auto-releases to the seller.`,
   `An AI reviewer and mediator give non-binding recommendations. No funds move without a party's action or the inspection-window rule above.`,
   `Signed electronically: buyer ${deal.buyerSignedAt ? new Date(deal.buyerSignedAt).toLocaleString() : '(unsigned)'}; seller ${deal.sellerSignedAt ? new Date(deal.sellerSignedAt).toLocaleString() : '(unsigned)'}.`]
    .forEach(t => line('• ' + t, 9));
  y += 6; line('Audit trail', 12, true); [...events].reverse().forEach((e: any) => line(`${new Date(e.createdAt).toLocaleString()} [${e.role}] ${e.message}`, 8, false, 3));
  y += 10; line('Hackathon prototype using the PayPal sandbox. Not a licensed escrow service and not legal advice.', 8);
  doc.save(`escrowpal-${deal.id}.pdf`);
}
