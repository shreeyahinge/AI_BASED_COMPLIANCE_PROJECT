const PDFDocument = require("pdfkit");

const generateWardReport = (data, res) => {
  const doc = new PDFDocument({ margin: 50 });

  // Stream directly to response
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=SmartBin-Report-${Date.now()}.pdf`
  );
  doc.pipe(res);

  // Header
  doc.fontSize(24).fillColor("#00b4d8").text("SmartBin", 50, 50);
  doc.fontSize(14).fillColor("#333").text("City Waste Management Report", 50, 82);
  doc.fontSize(10).fillColor("#666")
    .text(`Generated: ${new Date().toLocaleString()}`, 50, 102);

  doc.moveTo(50, 120).lineTo(550, 120).stroke("#00b4d8");

  // Overview Section
  doc.fontSize(16).fillColor("#333").text("Overview", 50, 140);
  doc.fontSize(11).fillColor("#444");
  const overview = data.overview;
  doc.text(`Total Bins: ${overview.totalBins}`, 50, 165);
  doc.text(`Critical Bins: ${overview.criticalBins}`, 200, 165);
  doc.text(`Total Reports: ${overview.totalReports}`, 350, 165);
  doc.text(`Resolved Reports: ${overview.resolvedReports}`, 50, 185);
  doc.text(`Resolution Rate: ${overview.resolutionRate}%`, 200, 185);
  doc.text(`Completed Tasks: ${overview.completedTasks}`, 350, 185);

  doc.moveTo(50, 210).lineTo(550, 210).stroke("#eee");

  // Ward Stats Section
  doc.fontSize(16).fillColor("#333").text("Ward-wise Statistics", 50, 225);

  let yPos = 250;
  const wardStats = data.wardStats || [];

  // Table header
  doc.fontSize(10).fillColor("#00b4d8");
  doc.text("Ward", 50, yPos);
  doc.text("Reports", 200, yPos);
  doc.text("Critical", 300, yPos);
  doc.text("Resolved", 400, yPos);
  doc.text("Avg Fill %", 480, yPos);

  yPos += 18;
  doc.moveTo(50, yPos).lineTo(550, yPos).stroke("#ddd");
  yPos += 8;

  wardStats.forEach((ward) => {
    doc.fontSize(10).fillColor("#333");
    doc.text(ward._id || "Unknown", 50, yPos, { width: 140 });
    doc.text(String(ward.totalReports), 200, yPos);
    doc.text(String(ward.criticalReports), 300, yPos);
    doc.text(String(ward.resolvedReports), 400, yPos);
    doc.text(`${Math.round(ward.avgFillLevel || 0)}%`, 480, yPos);
    yPos += 20;

    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }
  });

  // Footer
  doc.fontSize(9).fillColor("#999")
    .text("SmartBin — AI Powered City Waste Management", 50, 750, {
      align: "center", width: 500,
    });

  doc.end();
};

module.exports = { generateWardReport };