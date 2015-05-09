var leapjs = require("leapjs");
var mathjs = require("mathjs");
var net = require("net");
var child_process = require("child_process");

var config = {
  "PORT": 8170
};

// Utility function to convert Rad into Degree
function radToDeg(rad) {
  return 180*rad/mathjs.pi;
}

// Retrieve the vector of a bone
function getVec(bone) {
  var dir = bone.direction();
  var vec = leapjs.vec3.fromValues(dir[0],dir[1],dir[2]);
  return vec;
}

// Utility function to calculate the angle between two vectors
function getDegBetween(vec1,vec2) {
  var bottomCos=leapjs.vec3.dot(vec1,vec2) / leapjs.vec3.len(vec1) / leapjs.vec3.len(vec2);
  return radToDeg(mathjs.acos(bottomCos));
}

// Deg -> pulse width
// Available pulse width for small servos: 500-2200
function degToPulse(deg,big) {
  if(big) {}
  else {
    return parseInt(600 + deg/180*1600);
  }
}

var portMapping = {
  "H_T": {"port": 1},
  "H_L": {"port": 2},
  "1_T": {"port": 3},
  "1_M": {"port": 4},
  "1_B": {"port": 5},
  "2_T": {"port": 6},
  "2_B": {"port": 7, "reversed": true},
  "3_T": {"port": 8},
  "3_B": {"port": 9, "reversed": true}
}

function buildCmd(actionSet) {
  str = "";

  for(id in actionSet)
    if(id in portMapping)
      str = str + "#" + portMapping[id].port + "P" + degToPulse(
          portMapping[id].reversed?180-actionSet[id]:actionSet[id]
          );

  str+="T100";
  return str;
}

// Initialize Leap Motion controller
var controller = new leapjs.Controller({
  frameEventName: "deviceFrame"
});
controller.connect();

var latestData;

// Register listener for the controller
controller.on("frame",function(frame) {
  if(frame.valid) {
    var result={}
    frame.hands.forEach(function(hand) {
      if(hand.type=="right" && hand.confidence > .7) hand.fingers.forEach(function(finger) {
        if(finger.type== 0 ) { //THUMB
          var bottomBone = finger.proximal;
          var middlePartBone = finger.medial;
          var topPartBone = finger.distal;

          var topVec= getVec(topPartBone);
          var middlePartVec= getVec(middlePartBone);
          var bottomPartVec= getVec(bottomBone);

          var bottomVec = leapjs.vec3.create();
          leapjs.vec3.add(bottomVec,bottomPartVec,middlePartVec);


          var handDirection = hand.direction;
          var handVec = leapjs.vec3.fromValues(handDirection[0],handDirection[1],handDirection[2]);

          var bottomDeg=getDegBetween(bottomVec,handVec);
          var topDeg=getDegBetween(bottomVec,topVec);

          result["1_T"]=topDeg;
          result["1_B"]=bottomDeg;
          result["hasData"]=true;
        } else if(finger.type==1) { // INDEX
          var distalVec= getVec(finger.distal);
          var medialVec= getVec(finger.medial);
          var proximalVec = getVec(finger.proximal);
          var metaVec = getVec(finger.metacarpal);

          var topVec = leapjs.vec3.create();
          leapjs.vec3.add(topVec,medialVec,distalVec);

          var topDeg=getDegBetween(proximalVec,topVec);
          var bottomDeg=getDegBetween(metaVec,proximalVec);

          result["2_T"]=topDeg;
          result["2_B"]=bottomDeg;
          result["hasData"]=true;
        } else if(finger.type==3) { // INDEX
          var medialVec= getVec(finger.medial);
          var distalVec= getVec(finger.distal);
          var metaVec = getVec(finger.metacarpal);
          var proximalVec = getVec(finger.proximal);

          var topVec = leapjs.vec3.create();
          leapjs.vec3.add(topVec,medialVec,distalVec);

          var bottomDeg=getDegBetween(metaVec,proximalVec);
          var topDeg=getDegBetween(proximalVec,topVec);

          result["3_T"]=topDeg;
          result["3_B"]=bottomDeg;
          result["hasData"]=true;
        }
      });
    });
    // TODO: add hand
    
    if(result["hasData"]) {
      latestData = result;
    }
  }
});

var proc = child_process.spawn(
    "python",
    ["signal.py"]
    )

proc.stdout.on("data",function(data) {
  console.log(data);
});

function flushData() {
  if(!latestData || !latestData["hasData"]) return;

  var cmd=buildCmd(latestData);

  console.log(cmd);
  proc.stdin.write(cmd+"\n");
  latestData = null;
}

var interval = setInterval(flushData,200);

process.stdin.on("data",function(data) {
  if(data == "stop") {
    console.log("exiting...");
    proc.stdin.write("STOP");
    clearInterval(interval);
    process.exit(0);
  } else {
    console.log("Unkonwn command");
  }
});
