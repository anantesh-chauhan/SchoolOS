import PDFDocument from 'pdfkit';
import prisma from '../../config/prisma.client.js';
import QRCode from 'qrcode';

export const streamReceiptPdf = async (req, res) => {
  const receipt = await prisma.feeReceipt.findFirst({ where: { id: req.params.id, schoolId: req.user.schoolId }, include: { school: true, payment: { include: { student: true, allocations: { include: { charge: { include: { feeComponent: true } } } } } } } });
  if (!receipt) return res.status(404).json({ success: false, message: 'Receipt not found' });
  if (['STUDENT', 'PARENT'].includes(req.user.role) && receipt.payment.studentId !== req.user.studentId) return res.status(403).json({ success: false, message: 'Forbidden' });
  await prisma.$transaction([
    prisma.feeReceipt.update({ where: { id: receipt.id }, data: { printCount: { increment: 1 }, lastPrintedAt: new Date() } }),
    prisma.feeAuditLog.create({ data: { schoolId: req.user.schoolId, userId: req.user.id, userRole: req.user.role, action: 'RECEIPT_PRINTED', entityType: 'FeeReceipt', entityId: receipt.id, ipAddress: req.ip, userAgent: req.get('user-agent') } }),
  ]);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${receipt.receiptNumber.replace(/\//g, '-')}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: 48 }); doc.pipe(res);
  const verificationUrl = `${process.env.PUBLIC_APP_URL || 'http://localhost:5173'}/fees/verify/${receipt.verificationCode}`;
  const qr = await QRCode.toBuffer(verificationUrl, { width: 120, margin: 1, errorCorrectionLevel: 'M' });
  doc.fontSize(20).text(receipt.school.schoolName, { align: 'center' }).fontSize(9).text(receipt.school.address || '', { align: 'center' }).moveDown();
  doc.fontSize(16).text(receipt.status === 'CANCELLED' ? 'CANCELLED FEE RECEIPT' : 'FEE RECEIPT', { align: 'center' }).moveDown();
  doc.fontSize(10).text(`Receipt: ${receipt.receiptNumber}`).text(`Academic session: ${receipt.academicSession}`).text(`Payment date: ${receipt.payment.paymentDate.toLocaleDateString('en-IN')}`).moveDown();
  const student = receipt.payment.student;
  doc.text(`Student: ${student.studentFirstName} ${student.studentLastName || ''}`).text(`Admission no: ${student.admissionNo || '-'}`).text(`Class / section: ${student.className}${student.section ? ` / ${student.section}` : ''}`).text(`Parent / guardian: ${student.fatherName}`).moveDown();
  doc.font('Helvetica-Bold').text('Fee details').font('Helvetica');
  receipt.payment.allocations.forEach((allocation) => doc.text(`${allocation.charge.feeComponent?.name || allocation.charge.installmentName}: ${(Number(allocation.amountMinor) / 100).toFixed(2)}`));
  doc.moveDown().font('Helvetica-Bold').text(`Amount paid: ${(Number(receipt.payment.amountMinor) / 100).toFixed(2)}`).font('Helvetica').text(`Payment method: ${receipt.payment.method.replaceAll('_', ' ')}`).text(`Reference: ${receipt.payment.transactionReference || receipt.payment.paymentNumber}`).moveDown();
  doc.image(qr, 430, 600, { width: 100 }).fontSize(8).text(`Verification code: ${receipt.verificationCode}`).text(`Verify: ${verificationUrl}`, { width: 360 }).text(`Status: ${receipt.status}`).text(receipt.printCount > 0 ? `Duplicate copy #${receipt.printCount + 1}` : 'Original copy').moveDown();
  doc.text('This is a system-generated receipt. Verify it using the receipt verification code.', { align: 'center' });
  if (receipt.status === 'CANCELLED') doc.save().rotate(-30, { origin: [300, 400] }).fontSize(60).fillColor('#dc2626').opacity(0.2).text('CANCELLED', 80, 350).restore();
  doc.end();
};
