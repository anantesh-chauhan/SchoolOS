import PDFDocument from "pdfkit";
import prisma from "../../config/prisma.client.js";
import QRCode from "qrcode";

const amountInWords = (minor) => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const underHundred = (value) =>
    value < 20
      ? ones[value]
      : `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ""}`;
  const underThousand = (value) =>
    `${value >= 100 ? `${ones[Math.floor(value / 100)]} Hundred ` : ""}${underHundred(value % 100)}`.trim();
  let rupees = Math.floor(Number(minor) / 100);
  const paise = Number(minor) % 100;
  if (rupees === 0)
    return paise ? `${underHundred(paise)} Paise Only` : "Zero Rupees Only";
  const parts = [];
  for (const [divisor, label] of [
    [10000000, "Crore"],
    [100000, "Lakh"],
    [1000, "Thousand"],
  ])
    if (rupees >= divisor) {
      parts.push(`${underThousand(Math.floor(rupees / divisor))} ${label}`);
      rupees %= divisor;
    }
  if (rupees) parts.push(underThousand(rupees));
  return `${parts.join(" ")} Rupees${paise ? ` and ${underHundred(paise)} Paise` : ""} Only`;
};

export const streamReceiptPdf = async (req, res) => {
  const receipt = await prisma.feeReceipt.findFirst({
    where: { id: req.params.id, schoolId: req.user.schoolId },
    include: {
      school: true,
      payment: {
        include: {
          student: true,
          allocations: {
            include: { charge: { include: { feeComponent: true } } },
          },
        },
      },
    },
  });
  if (!receipt)
    return res
      .status(404)
      .json({ success: false, message: "Receipt not found" });
  if (["STUDENT", "PARENT"].includes(req.user.role)) {
    // STUDENT: studentId in token is authoritative.
    if (req.user.role === "STUDENT") {
      if (receipt.payment.studentId !== req.user.studentId) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    }

    // PARENT: validate receipt.student belongs to any active family link for this parent.
    if (req.user.role === "PARENT") {
      const familyLink = await prisma.feeFamilyLink.findFirst({
        where: {
          schoolId: req.user.schoolId,
          parentUserId: { in: [req.user.id, req.user.email].filter(Boolean) },
          studentId: receipt.payment.studentId,
          active: true,
        },
        select: { id: true },
      });
      if (!familyLink) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    }
  }

  await prisma.$transaction([
    prisma.feeReceipt.update({
      where: { id: receipt.id },
      data: { printCount: { increment: 1 }, lastPrintedAt: new Date() },
    }),
    prisma.feeAuditLog.create({
      data: {
        schoolId: req.user.schoolId,
        userId: req.user.id,
        userRole: req.user.role,
        action: "RECEIPT_PRINTED",
        entityType: "FeeReceipt",
        entityId: receipt.id,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      },
    }),
  ]);
  res.setHeader("Content-Type", "application/pdf");
  const snapshotStudent = receipt.snapshot?.student || {};
  const safeName = String(snapshotStudent.name || "Student")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_|_$/g, "");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="Fee_Receipt_${safeName}_${receipt.receiptNumber.replace(/\//g, "-")}.pdf"`,
  );
  const doc = new PDFDocument({ size: "A4", margin: 48 });
  doc.pipe(res);
  const verificationUrl = `${process.env.PUBLIC_APP_URL || "http://localhost:5173"}/fees/verify/${receipt.verificationCode}`;
  const qr = await QRCode.toBuffer(verificationUrl, {
    width: 120,
    margin: 1,
    errorCorrectionLevel: "M",
  });
  doc
    .fontSize(20)
    .text(receipt.school.schoolName, { align: "center" })
    .fontSize(9)
    .text(receipt.school.address || "", { align: "center" })
    .moveDown();
  doc
    .fontSize(16)
    .text(
      receipt.status === "VALID"
        ? "FEE RECEIPT"
        : `${receipt.status} FEE RECEIPT`,
      { align: "center" },
    )
    .moveDown();
  doc
    .fontSize(10)
    .text(`Receipt: ${receipt.receiptNumber}`)
    .text(`Academic session: ${receipt.academicSession}`)
    .text(
      `Payment date: ${receipt.payment.paymentDate.toLocaleDateString("en-IN")}`,
    )
    .moveDown();
  const student = receipt.payment.student;
  const studentName =
    snapshotStudent.name ||
    `${student.studentFirstName} ${student.studentLastName || ""}`.trim();
  const className = snapshotStudent.className || student.className;
  const section = snapshotStudent.section ?? student.section;
  doc
    .text(`Student: ${studentName}`)
    .text(
      `Admission no: ${snapshotStudent.admissionNo || student.admissionNo || "-"}`,
    )
    .text(`Class / section: ${className}${section ? ` / ${section}` : ""}`)
    .text(
      `Parent / payer: ${receipt.payment.payerName || snapshotStudent.parentName || student.fatherName || "-"}`,
    )
    .moveDown();
  doc.font("Helvetica-Bold").text("Fee details").font("Helvetica");
  receipt.payment.allocations.forEach((allocation) =>
    doc.text(
      `${allocation.charge.feeComponent?.name || allocation.charge.installmentName}: ${(Number(allocation.amountMinor) / 100).toFixed(2)}`,
    ),
  );
  doc
    .moveDown()
    .font("Helvetica-Bold")
    .text(
      `Amount received: INR ${(Number(receipt.payment.amountMinor) / 100).toFixed(2)}`,
    )
    .font("Helvetica")
    .text(`In words: ${amountInWords(receipt.payment.amountMinor)}`)
    .text(`Payment method: ${receipt.payment.method.replaceAll("_", " ")}`)
    .text(
      `Reference: ${receipt.payment.transactionReference || receipt.payment.instrumentNumber || receipt.payment.paymentNumber}`,
    )
    .text(`Collector: ${receipt.payment.collectedById || "School fee office"}`)
    .moveDown();
  doc
    .image(qr, 430, 600, { width: 100 })
    .fontSize(8)
    .text(`Verification code: ${receipt.verificationCode}`)
    .text(`Verify: ${verificationUrl}`, { width: 360 })
    .text(`Status: ${receipt.status}`)
    .text(
      receipt.printCount > 0
        ? `Duplicate copy #${receipt.printCount + 1}`
        : "Original copy",
    )
    .moveDown();
  doc.text(
    `Generated ${receipt.createdAt.toLocaleString("en-IN")} · Computer-generated receipt · Authorized signature not required.`,
    { align: "center" },
  );
  if (receipt.status !== "VALID")
    doc
      .save()
      .rotate(-30, { origin: [300, 400] })
      .fontSize(60)
      .fillColor("#dc2626")
      .opacity(0.2)
      .text(receipt.status, 80, 350)
      .restore();
  doc.end();
};
