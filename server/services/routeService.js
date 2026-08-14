const Task = require("../models/Task");

const optimiseRoute = async (officerId) => {
  try {
    // Get all pending/in-progress tasks for this officer
    const tasks = await Task.find({
      assignedTo: officerId,
      status: { $in: ["pending", "in_progress"] },
    }).populate("bin", "location binId area fillLevel status");

    if (tasks.length === 0) {
      return { message: "No pending tasks to optimise" };
    }

    if (tasks.length === 1) {
      const bin = tasks[0].bin;
      return {
        optimised: true,
        waypoints: [{
          taskId: tasks[0]._id,
          binId: bin.binId,
          address: bin.location.address,
          lat: bin.location.coordinates[1],
          lng: bin.location.coordinates[0],
          fillLevel: bin.fillLevel,
          status: bin.status,
        }],
        // Universal free Google Maps link for a single destination
        googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${bin.location.coordinates[1]},${bin.location.coordinates[0]}`,
        message: "Single task — direct navigation",
      };
    }

    // Build waypoints for Google Maps
    const waypoints = tasks.map((task) => ({
      taskId: task._id,
      binId: task.bin.binId,
      address: task.bin.location.address,
      lat: task.bin.location.coordinates[1],
      lng: task.bin.location.coordinates[0],
      fillLevel: task.bin.fillLevel,
      status: task.bin.status,
      priority: task.priority,
    }));

    // Logic: Sort by priority first (Critical -> High -> Medium -> Low)
    // This is actually better than pure distance routing, because an overflowing bin is more urgent than a close bin!
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    waypoints.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Build the free Google Maps URL with all waypoints
    const destination = waypoints[waypoints.length - 1];
    const middleWaypoints = waypoints.slice(0, -1);
    
    const waypointStr = middleWaypoints
      .map((w) => `${w.lat},${w.lng}`)
      .join("|");

    // This creates a multi-stop route link that opens directly in the Google Maps app
    const googleMapsUrl =
      `https://www.google.com/maps/dir/?api=1` +
      `&destination=${destination.lat},${destination.lng}` +
      (waypointStr ? `&waypoints=${waypointStr}` : "");

    return {
      optimised: true,
      totalTasks: tasks.length,
      waypoints,
      googleMapsUrl,
      message: `Priority route generated for ${tasks.length} bins!`,
    };
  } catch (error) {
    return { optimised: false, message: error.message };
  }
};

module.exports = { optimiseRoute };