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

    if (yPos > 680) {
      doc.addPage();
      yPos = 50;
    }
  });

  // Task & Officer Assignments Section
  const tasks = data.tasks || [];
  if (tasks.length > 0) {
    if (yPos > 520) {
      doc.addPage();
      yPos = 50;
    } else {
      yPos += 15;
      doc.moveTo(50, yPos).lineTo(550, yPos).stroke("#eee");
      yPos += 15;
    }

    doc.fontSize(16).fillColor("#333").text("Task & Officer Assignments", 50, yPos);
    yPos += 25;

    // Table Header
    doc.fontSize(9).fillColor("#00b4d8");
    doc.text("Task / Bin", 50, yPos, { width: 100 });
    doc.text("Location / Ward", 155, yPos, { width: 120 });
    doc.text("Assigned Officer", 280, yPos, { width: 120 });
    doc.text("Priority", 405, yPos, { width: 65 });
    doc.text("Status", 475, yPos, { width: 75 });

    yPos += 15;
    doc.moveTo(50, yPos).lineTo(550, yPos).stroke("#ddd");
    yPos += 6;

    tasks.forEach((t) => {
      const binCode = t.bin?.binId || "BIN-" + String(t._id).slice(-4);
      const location = (t.bin?.location?.address || `${t.city || ""} ${t.ward || ""}`).slice(0, 22);
      const officer = t.assignedTo ? `${t.assignedTo.name}` : "Unassigned";
      const priority = (t.priority || "normal").toUpperCase();
      const status = (t.status || "pending").replace("_", " ").toUpperCase();

      doc.fontSize(9).fillColor("#333");
      doc.text(binCode, 50, yPos, { width: 100 });
      doc.text(location, 155, yPos, { width: 120 });
      doc.text(officer, 280, yPos, { width: 120 });

      // Priority color
      if (t.priority === "critical") doc.fillColor("#ef4444");
      else if (t.priority === "high") doc.fillColor("#f59e0b");
      else doc.fillColor("#3b82f6");
      doc.text(priority, 405, yPos, { width: 65 });

      // Status color
      if (t.status === "completed") doc.fillColor("#10b981");
      else if (t.status === "in_progress") doc.fillColor("#3b82f6");
      else doc.fillColor("#6b7280");
      doc.text(status, 475, yPos, { width: 75 });

      yPos += 18;
      if (yPos > 700) {
        doc.addPage();
        yPos = 50;
      }
    });
  }

  // Footer
  doc.fontSize(9).fillColor("#999")
    .text("SmartBin — AI Powered City Waste Management", 50, 750, {
      align: "center", width: 500,
    });

  doc.end();
};

module.exports = { generateWardReport };