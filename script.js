const $ = (s,root=document) => root.querySelector(s);



const $$ = (s,root=document) => [

  ...root.querySelectorAll(s)

];





const state = {



  totalSlots:12,



  vehicles:[],



  revenue:0,



  securityFails:0,



  securityEvents:[],



  currentMain:"q0",



  activity:[],



  payment:0,



  fee:20,



  paymentVehicle:null,

  selectedHours:1,

  ratePerHour:20,



  dfaRuns:0,



  nfaRuns:0,



  regexRuns:0,



  animating:false,



  nextAuto:0



};





const platePattern =

/^[A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4}$/;





const dfaStates = [



["q0","2 letters","q1","Prefix"],



["q1","letter","q2","Second letter"],



["q2","digit","q3","District digit 1"],



["q3","digit","q4","District complete"],



["q4","letter","q5","Series letter 1"],



["q5","letter","q6","Series complete"],



["q6","digit","q7","Number digit 1"],



["q7","digit","q8","Number digit 2"],



["q8","digit","q9","Number digit 3"],



["q9","digit","qA","Accept after digit 4"]



];





function now(){



  return new Date().toLocaleTimeString(

    [],

    {

      hour:"2-digit",

      minute:"2-digit",

      second:"2-digit"

    }

  );



}





function toast(msg){



  const t = $("#toast");



  t.textContent = msg;



  t.classList.add("show");



  clearTimeout(window.__toast);



  window.__toast = setTimeout(

    () => t.classList.remove("show"),

    2300

  );



}





function normalizePlate(v){



  return v.trim().toUpperCase();



}





function validPlate(v){



  return platePattern.test(

    normalizePlate(v)

  );



}





function log(msg,type=""){



  state.activity.unshift({

    time:now(),
            parkedAt:Date.now(),

    msg,

    type

  });



  state.activity =

    state.activity.slice(0,40);



  renderActivity();



}





function renderActivity(){



  $("#activityLog").innerHTML =

  state.activity.length



  ?



  state.activity.map(x => `



    <div class="entry ${x.type}">



      <small>${x.time}</small>



      ${x.msg}



    </div>



  `).join("")



  :



  `



  <div class="entry">



    <small>${now()}</small>



    System initialized.



  </div>



  `;



}





function getParkingHours(vehicle){
  if(!vehicle || !vehicle.parkedAt) return 1;
  return Math.max(1, Math.ceil((Date.now() - vehicle.parkedAt) / 3600000));
}

function getParkingFee(vehicle){
  return getParkingHours(vehicle) * state.ratePerHour;
}

function vehicleByPlate(plate){



  return state.vehicles.find(

    v => v.plate === normalizePlate(plate)

  );



}





function freeSlot(){



  for(

    let i=1;

    i<=state.totalSlots;

    i++

  ){



    if(

      !state.vehicles.some(

        v => v.slot === i

      )

    ){



      return i;



    }



  }



  return null;



}





function updateStats(){



  const occ =

    state.vehicles.length;



  const pct =

    Math.round(

      occ/state.totalSlots*100

    );



  const available =

    Math.max(

      0,

      state.totalSlots-occ

    );





  $("#availableSlots").textContent =

    available;



  $("#totalSlots").textContent =

    state.totalSlots;



  $("#occupiedSlots").textContent =

    occ;



  $("#revenue").textContent =

    "₹"+state.revenue;



  $("#securityEvents").textContent =

    state.securityEvents.length;





  $("#capacityPercent").textContent =

    pct+"%";



  $("#capacityText").textContent =

    `${occ} / ${state.totalSlots} slots occupied`;



  $("#capacityBar").style.width =

    pct+"%";





  $(".ring").style.background =

  `conic-gradient(

      var(--green) ${pct}%,

      #28323f ${pct}%

  )`;





  $("#capacityStatus").textContent =

    pct === 100

      ? "PARKING FULL"

      : pct >= 80

        ? "High occupancy"

        : "Parking available";





  $("#capacityChip").textContent =

    `${occ} / ${state.totalSlots}`;





  renderSlots();



  renderLedger();



}





function renderSlots(){



  $("#slotGrid").innerHTML =



  Array.from(

    {

      length:state.totalSlots

    },



    (_,i) => {



      const v =

        state.vehicles.find(

          x => x.slot === i+1

        );





      return `



      <div

        class="

          slot

          ${v ? "occupied":""}

          ${

            state.paymentVehicle === v?.plate

            ? "selected"

            : ""

          }

        "

        data-slot="${i+1}"

      >



        <b>

          P${String(i+1).padStart(2,"0")}

        </b>



        <span>

          ${v ? v.plate : "FREE"}

        </span>



      </div>



      `;



    }



  ).join("");



}





function renderLedger(){



  const box =

    $("#vehicleLedger");





  if(!state.vehicles.length){



    box.innerHTML = `



      <div class="empty">



        No vehicles parked yet.



      </div>



    `;



    return;



  }





  box.innerHTML =



  state.vehicles.map(v => `



    <div

      class="

        ledger-row

        ${

          state.paymentVehicle === v.plate

          ? "selected"

          : ""

        }

      "

    >



      <div>



        <b>

          ${v.plate}

        </b>



        <small>



          Slot P${String(v.slot).padStart(2,"0")}



          · parked ${v.time}



        </small>



      </div>



      <span class="paid-tag">₹${getParkingFee(v)} DUE</span>



    </div>



  `).join("");



}





function setMainState(q){



  state.currentMain = q;



  $("#globalState").textContent = q;





  const order = [

    "q0",

    "q1",

    "q2",

    "q3",

    "q4",

    "q5",

    "q6",

    "q7",

    "q8"

  ];





  const idx =

    order.indexOf(q);





  $$("#mainStateMachine .state")

  .forEach(n => {



    const i =

      order.indexOf(

        n.dataset.state

      );





    n.classList.toggle(

      "current",

      n.dataset.state === q

    );





    n.classList.toggle(

      "done",

      i >= 0 && i < idx

    );



  });



}





function animateMain(

  sequence,

  done

){



  sequence.forEach(

    (q,i) => {



      setTimeout(

        () => setMainState(q),

        i*430

      );



    }

  );





  setTimeout(

    done,

    sequence.length*430

  );



}





function generateAutoPlate(){



  state.nextAuto++;



  const n =

    String(

      1000 + state.nextAuto

    ).slice(-4);





  return `MH12${

    String.fromCharCode(

      65 + (state.nextAuto % 26)

    )

  }${

    String.fromCharCode(

      65 + ((state.nextAuto*3)%26)

    )

  }${n}`;



}





function setIncoming(

  plate,

  status,

  cls=""

){



  const box =

    $("#incomingVehicle");



  box.className =

    "incoming "+cls;



  $("#incomingPlate").textContent =

    plate || "—";



  $("#incomingStatus").textContent =

    status;



}





function simulateVehicle(){



  if(state.animating)

    return;





  const plate =

    normalizePlate(

      $("#vehicleInput").value

    );





  setIncoming(

    plate || "—",

    "Vehicle approaching..."

  );





  /* INVALID */



  if(!validPlate(plate)){



    setMainState("q1");



    setIncoming(

      plate || "—",

      "REJECTED — INVALID VEHICLE NUMBER",

      "rejected"

    );





    log(

      `Entry rejected: invalid vehicle number "${plate || "empty"}".`,

      "bad"

    );





    triggerSecurity(

      "Invalid vehicle number"

    );





    toast(

      "Invalid vehicle number."

    );



    return;



  }





  /* DUPLICATE */



  if(vehicleByPlate(plate)){



    setMainState("q2");



    setIncoming(

      plate,

      "REJECTED — DUPLICATE VEHICLE",

      "rejected"

    );





    log(

      `Entry rejected: duplicate vehicle ${plate}.`,

      "bad"

    );





    triggerSecurity(

      `Duplicate vehicle: ${plate}`

    );





    toast(

      "Duplicate vehicle blocked."

    );



    return;



  }





  state.animating = true;





  setIncoming(

    plate,

    "Detected — validating...",

    "detected"

  );





  const sequence = [

    "q0",

    "q1",

    "q2",

    "q3"

  ];





  animateMain(

    sequence,

    () => {





      /* PARKING FULL */



      if(

        state.vehicles.length >=

        state.totalSlots

      ){



        setMainState("q3");





        setIncoming(

          plate,

          `PARKING FULL — vehicle ${plate} cannot enter`,

          "rejected"

        );





        log(

          `PARKING FULL: incoming vehicle ${plate} rejected at q3. Capacity 12/12.`,

          "bad"

        );





        toast(

          `PARKING FULL — ${plate}`

        );





        state.animating = false;



        return;



      }





      const slot =

        freeSlot();





      setMainState("q4");





      setTimeout(

        () => {



          const v = {



            plate,



            slot,



            time:now()



          };





          state.vehicles.push(v);





          setMainState("q5");





          updateStats();





          setIncoming(

            plate,

            `PARKED SUCCESSFULLY — Slot P${String(slot).padStart(2,"0")}`,

            "accepted"

          );





          const el =

            $(

              `.slot[data-slot="${slot}"]`

            );





          if(el){



            el.classList.add(

              "pop"

            );





            setTimeout(

              () =>

              el.classList.remove(

                "pop"

              ),

              700

            );



          }





          log(

            `Vehicle ${plate} allocated to P${String(slot).padStart(2,"0")}. Occupancy ${state.vehicles.length}/${state.totalSlots}.`,

            "ok"

          );





          toast(

            `${plate} parked at P${String(slot).padStart(2,"0")}`

          );





          state.animating = false;



        },

        420

      );



    }

  );



}





function autoVehicle(){



  if(state.animating)

    return;





  let p =

    generateAutoPlate();





  while(vehicleByPlate(p)){



    p =

      generateAutoPlate();



  }





  $("#vehicleInput").value =

    p;





  simulateVehicle();



}





/* ================= DFA ================= */



function setupDfa(){



  $("#dfaTable").innerHTML =



  dfaStates.map(

    r => `



      <tr>



        <td>${r[0]}</td>



        <td>${r[1]}</td>



        <td>${r[2]}</td>



        <td>${r[3]}</td>



      </tr>



    `

  ).join("");



}





function runDfa(){



  const input =

    normalizePlate(

      $("#dfaInput").value

    );





  const display =

    $("#dfaDisplay");



  const result =

    $("#dfaResult");





  state.dfaRuns++;





  display.innerHTML = "";





  [...input].forEach(

    (c,i) => {



      const d =

        document.createElement("div");





      d.className =

        "char";





      d.innerHTML = `



        <b>${c}</b>



        <small>

          q${i}

        </small>



      `;





      display.appendChild(d);





      setTimeout(

        () =>

        d.classList.add(

          "active"

        ),

        i*130

      );



    }

  );





  setTimeout(

    () => {



      const ok =

        platePattern.test(input);





      result.className =

        "result "+(

          ok

          ? "ok"

          : "bad"

        );





      result.innerHTML =



      ok



      ?



      `✓ ACCEPTED — <b>${input}</b> reaches qA.`



      :



      `✗ REJECTED — <b>${input || "ε"}</b> has no accepting transition.`;





      log(

        `DFA "${input || "ε"}" → ${ok ? "ACCEPT":"REJECT"}`,

        ok ? "ok":"bad"

      );



    },



    Math.max(

      400,

      input.length*130

    )



  );



}





/* ================= NFA ================= */



function runNfa(){



  const input =

    normalizePlate(

      $("#nfaInput").value

    );





  const visual =

    $("#nfaVisual");



  const result =

    $("#nfaResult");





  state.nfaRuns++;





  visual.innerHTML = "";





  const nodes = [

    "q0",

    "q1",

    "q2",

    "q3",

    "q4",

    "q5",

    "qA"

  ];





  const wrap =

    document.createElement(

      "div"

    );





  wrap.className =

    "nfa-path";





  visual.appendChild(

    wrap

  );





  nodes.forEach(

    (n,i) => {



      const e =

        document.createElement(

          "div"

        );





      e.className =

        "nfa-node";





      e.textContent = n;





      wrap.appendChild(e);





      if(

        i <

        nodes.length-1

      ){



        const a =

          document.createElement(

            "span"

          );





        a.textContent = "→";





        wrap.appendChild(a);



      }



    }

  );





  const branch =

    document.createElement(

      "div"

    );





  branch.className =

    "nfa-branch";





  branch.innerHTML = `



    q2 ↗ q2a (dead)



    <br>



    ↘ q3 (valid path)



  `;





  visual.appendChild(

    branch

  );





  const ok =

    platePattern.test(input);





  $$(".nfa-node",visual)

  .forEach(

    (n,i) => {



      setTimeout(

        () =>

        n.classList.add(

          "active"

        ),

        i*170

      );



    }

  );





  setTimeout(

    () => {



      if(ok){



        $(".nfa-node:last-child",visual)

        .classList.add(

          "accept"

        );



      }





      result.className =

        "result "+(

          ok

          ? "ok"

          : "bad"

        );





      result.innerHTML =



      ok



      ?



      `✓ NFA found an accepting path for <b>${input}</b>.`



      :



      `✗ All paths reject <b>${input || "ε"}</b>.`;





      log(

        `NFA "${input || "ε"}" → ${ok ? "ACCEPTING PATH":"REJECT"}`,

        ok ? "ok":"bad"

      );



    },



    nodes.length*175

  );



}





/* ================= REGEX ================= */



function runRegex(){



  const p =

    $("#regexPattern").value;



  const input =

    $("#regexInput").value;



  const result =

    $("#regexResult");



  const meter =

    $("#regexMeter");





  state.regexRuns++;





  let ok = false;



  let error = "";





  try{



    ok =

      new RegExp(p).test(

        input

      );



  }



  catch(e){



    error =

      "Invalid regular expression.";



  }





  meter.style.width =

    ok ? "100%" : "15%";





  result.className =

    "result "+(

      ok ? "ok":"bad"

    );





  result.textContent =



    error ||



    (



      ok



      ?



      `✓ MATCH — "${input}" belongs to L.`



      :



      `✗ NO MATCH — "${input}" does not belong to L.`



    );





  log(

    `Regex "${input}" → ${

      error

      ? "ERROR"

      : ok

        ? "MATCH"

        : "NO MATCH"

    }`,

    ok ? "ok":"bad"

  );



}





/* ================= PAYMENT ================= */



function currentPayState(){
  return Math.floor(state.payment / 20);
}

function renderPayment(){
  $("#paidDisplay").textContent = "₹" + state.payment;

  const requiredFee = $("#requiredFee");
  if(requiredFee) requiredFee.textContent = "₹" + state.fee;

  $("#paymentTarget").innerHTML = state.paymentVehicle
    ? `Payment target: <b>${state.paymentVehicle}</b> · ${state.selectedHours || 1} hour(s) · ₹${state.fee} due (₹${state.ratePerHour}/hour)`
    : "No vehicle selected for payment.";

  const count = Math.max(12, Math.ceil(state.fee / 20) + 4);

  $("#paymentStates").innerHTML = Array.from({length:count}, (_,i) => {
    const amount = i * 20;
    return `<div class="paystate ${currentPayState() === i ? "active" : ""} ${amount >= state.fee ? "accept" : ""}">
      <b>qP${i}</b>
      <small>₹${amount}${amount >= state.fee ? " · ACCEPT" : ""}</small>
    </div>`;
  }).join("");

  $("#paymentTable").innerHTML = Array.from({length:count}, (_,i) => {
    const amount = i * 20;
    return `<tr>
      <td>qP${i}</td>
      <td>₹${amount}</td>
      <td>${amount >= state.fee ? "Accept + calculate change" : "Accept next payment"}</td>
    </tr>`;
  }).join("");
}


function addPayment(amount){



  if(!state.paymentVehicle){



    $("#paymentResult").className =

      "result bad";





    $("#paymentResult").textContent =

      "✗ Select a vehicle by requesting its exit first.";





    triggerSecurity(

      "Payment attempted without an exit vehicle"

    );





    return;



  }





  if(

    state.paymentVehicle &&

    !vehicleByPlate(

      state.paymentVehicle

    )

  ){



    triggerSecurity(

      "Payment target no longer exists"

    );



    return;



  }





  state.payment += amount;





  renderPayment();





  const remaining =

    Math.max(

      0,

      state.fee-state.payment

    );





  const extra =

    Math.max(

      0,

      state.payment-state.fee

    );





  $("#paymentResult").className =

    "result "+

    (

      state.payment >= state.fee

      ? "ok"

      : ""

    );





  $("#paymentResult").textContent =



    state.payment >= state.fee



    ?



    `qP${currentPayState()} — fee satisfied. Change due: ₹${extra}.`



    :



    `qP${currentPayState()} — ₹${remaining} remaining.`;





  log(

    `₹${amount} inserted for ${state.paymentVehicle}. Total payment = ₹${state.payment}.`

  );



}





function requestExit(){



  const plate =

    normalizePlate(

      $("#exitVehicleInput").value

    );





  /* INVALID */



  if(!validPlate(plate)){



    triggerSecurity(

      "Invalid vehicle number used for exit"

    );





    showExit(

      "qE0",

      "Exit rejected",

      "Invalid vehicle number.",

      true

    );





    return;



  }





  /* VEHICLE NOT FOUND */



  const v =

    vehicleByPlate(

      plate

    );





  if(!v){



    triggerSecurity(

      `Nonexistent vehicle exit request: ${plate}`

    );





    showExit(

      "qE0",

      "Exit rejected",

      `${plate} is not parked.`,

      true

    );





    return;



  }





  /* SELECT VEHICLE */



  state.paymentVehicle =

    plate;





  state.selectedHours = getParkingHours(v);
  state.fee = getParkingFee(v);
  state.payment = 0;





  renderPayment();



  renderSlots();





  showExit(

    "qE1",

    "Vehicle found",

    `${plate} is at P${String(v.slot).padStart(2,"0")}. Payment required.`

  );





  setMainState(

    "q6"

  );





  log(

    `Exit requested for ${plate} at P${String(v.slot).padStart(2,"0")}. Payment locked to this vehicle.`

  );





  toast(

    `${plate} selected for exit`

  );



}





function showExit(

  q,

  title,

  msg,

  bad=false

){



  const c =

    $("#exitCard");





  c.className =

    "exit-card "+

    (bad ? "bad":"");





  c.innerHTML = `



    <span>

      ${q}

    </span>



    <b>

      ${title}

    </b>



    <small>

      ${msg}

    </small>



  `;



}





function completePayment(){



  /* NO VEHICLE SELECTED */

  if(!state.paymentVehicle){



    $("#paymentResult").className =

      "result bad";



    $("#paymentResult").textContent =

      "✗ No vehicle selected. Request an exit first.";



    return;

  }





  /* FIND SELECTED VEHICLE */

  const plate =

    normalizePlate(

      state.paymentVehicle

    );



  const vehicleIndex =

    state.vehicles.findIndex(

      v => v.plate === plate

    );





  /* VEHICLE NOT FOUND */

  if(vehicleIndex === -1){



    triggerSecurity(

      `Vehicle ${plate} no longer exists`

    );



    $("#paymentResult").className =

      "result bad";



    $("#paymentResult").textContent =

      `✗ ${plate} is not currently parked.`;



    return;

  }





  const v =

    state.vehicles[vehicleIndex];





  /* PAYMENT NOT COMPLETE */

  if(state.payment < state.fee){



    const left =

      state.fee - state.payment;



    $("#paymentResult").className =

      "result bad";



    $("#paymentResult").textContent =

      `✗ PAYMENT INCOMPLETE — ₹${left} still required.`;



    setMainState("q7");



    showExit(

      "qE2",

      "Exit BLOCKED",

      `${v.plate} must complete ₹${state.fee} payment.`

    );



    triggerSecurity(

      `Unpaid exit attempt: ${v.plate}`

    );



    return;

  }





  /* PAYMENT SUCCESS */

  const paid =

    state.payment;



  const change =

    paid - state.fee;





  /* Add the calculated hourly fee to revenue */

  state.revenue += state.fee;





  setMainState("q7");





  $("#paymentResult").className =

    "result ok";



  $("#paymentResult").textContent =

    `✓ Payment accepted: ₹${paid}. ₹${change} change returned.`;





  log(

    `Payment complete for ${v.plate}: ₹${paid} received. Revenue +₹${state.fee}.`,

    "ok"

  );





  showExit(

    "qE3",

    "Payment complete",

    `₹${state.fee} fee accepted. ₹${change} change returned. Vehicle is exiting...`

  );





  /* EXIT ANIMATION */

  setTimeout(() => {



    setMainState("q8");





    /*

     * REMOVE THE EXACT VEHICLE

     * FROM THE PARKING ARRAY

     */

    state.vehicles.splice(

      vehicleIndex,

      1

    );





    /*

     * SHOW THAT THE VEHICLE HAS EXITED

     */

    setIncoming(

      v.plate,

      `EXITED — P${String(v.slot).padStart(2,"0")} RELEASED`,

      "accepted"

    );





    /*

     * EXIT MESSAGE

     */

    showExit(

      "qE4",

      "EXIT SUCCESS",

      `${v.plate} has exited. P${String(v.slot).padStart(2,"0")} is now FREE.`

    );





    /*

     * ACTIVITY LOG

     */

    log(

      `Vehicle ${v.plate} exited from P${String(v.slot).padStart(2,"0")}. Slot released.`,

      "ok"

    );





    /*

     * CLEAR PAYMENT DATA

     */

    state.payment = 0;

    state.paymentVehicle = null;
      state.selectedHours = 1;
  state.fee = state.ratePerHour;
state.selectedHours = 1;
    state.fee = state.ratePerHour;
$("#exitVehicleInput").value = "";





    /*

     * IMPORTANT:

     * REFRESH PARKING SLOTS

     */

    renderSlots();





    /*

     * REFRESH PAYMENT PANEL

     */

    renderPayment();





    /*

     * REFRESH AVAILABLE / OCCUPIED COUNTERS

     */

    updateStats();





    toast(

      `${v.plate} exited successfully — P${String(v.slot).padStart(2,"0")} is FREE`

    );





  }, 900);



}





function clearSecurity(){



  state.securityFails = 0;



  state.securityEvents = [];





  $("#securityState").className =

    "security";





  $("#securityState").innerHTML = `



    <span>

      qS0

    </span>



    <strong>

      NORMAL

    </strong>



    <small>

      System secure

    </small>



  `;





  $("#securityLog").innerHTML =

    "";





  updateStats();





  toast(

    "Security reset to qS0 NORMAL."

  );



}





/* ================= REPORT ================= */



function reportHTML(){



  const occ =

    state.vehicles.length;





  const pct =

    Math.round(

      occ/state.totalSlots*100

    );





  return `



  <h2>

    Smart Parking 2.0 — Simulation Report

  </h2>



  <p>

    Generated:

    ${new Date().toLocaleString()}

  </p>





  <table>



    <tr>

      <th>Metric</th>

      <th>Value</th>

    </tr>



    <tr>

      <td>Capacity</td>

      <td>

        ${state.totalSlots} slots

      </td>

    </tr>



    <tr>

      <td>Occupied</td>

      <td>

        ${occ} (${pct}%)

      </td>

    </tr>



    <tr>

      <td>Available</td>

      <td>

        ${Math.max(

          0,

          state.totalSlots-occ

        )}

      </td>

    </tr>



    <tr>

      <td>Revenue</td>

      <td>

        ₹${state.revenue}

        (hourly parking fee)

      </td>

    </tr>



    <tr>

      <td>Security state</td>

      <td>

        qS${state.securityFails}

      </td>

    </tr>



    <tr>

      <td>Global FSM</td>

      <td>

        ${state.currentMain}

      </td>

    </tr>



  </table>





  <h3>

    Automata Modules

  </h3>



  <ul>



    <li>

      DFA vehicle validation

    </li>



    <li>

      NFA multiple-path demonstration

    </li>



    <li>

      Regex regular-language validation

    </li>



    <li>

      12-slot capacity FSM

    </li>



    <li>

      hourly payment automaton

      with partial payment and change

    </li>



    <li>

      Exact-vehicle exit FSM

      with payment lock

    </li>



    <li>

      Security FSM

      qS0 NORMAL →

      qS1 WARNING →

      qS2 ALERT →

      qS3 BLOCKED

    </li>



  </ul>





  <h3>

    Parked Vehicles

  </h3>



  ${

    state.vehicles.length



    ?



    `



    <ul>



      ${

        state.vehicles.map(

          v => `



            <li>



              ${v.plate}

              —

              P${String(v.slot).padStart(2,"0")}

              —

              ₹${getParkingFee(v)} due



            </li>



          `

        ).join("")

      }



    </ul>



    `



    :



    `<p>

      No vehicles currently parked.

    </p>`



  }





  <h3>

    Execution Statistics

  </h3>



  <p>



    DFA:

    ${state.dfaRuns}



    ·



    NFA:

    ${state.nfaRuns}



    ·



    Regex:

    ${state.regexRuns}



    ·



    Security events:

    ${state.securityEvents.length}



  </p>



  `;



}





function renderReport(){



  $("#reportPreview").innerHTML =

    reportHTML();



}





/* ================= JSON REPORT ================= */



function downloadJSON(){



  const payload = {



    project:

      "Smart Parking 2.0",



    generatedAt:

      new Date().toISOString(),



    capacity:{



      total:12,



      occupied:

        state.vehicles.length,



      available:

        Math.max(

          0,

          12-state.vehicles.length

        )



    },



    vehicles:

      state.vehicles,



    revenue:

      state.revenue,



    fee:state.fee,



    security:{



      state:

        `qS${state.securityFails}`,



      events:

        state.securityEvents



    },



    engines:{



      dfa:

        state.dfaRuns,



      nfa:

        state.nfaRuns,



      regex:

        state.regexRuns



    }



  };





  const blob =

    new Blob(

      [

        JSON.stringify(

          payload,

          null,

          2

        )

      ],

      {

        type:"application/json"

      }

    );





  const a =

    document.createElement(

      "a"

    );





  a.href =

    URL.createObjectURL(

      blob

    );





  a.download =

    "smart-parking-2-advanced-report.json";





  a.click();





  URL.revokeObjectURL(

    a.href

  );



}





/* ================= RESET ================= */



function resetAll(){



  state.vehicles = [];



  state.revenue = 0;



  state.securityFails = 0;



  state.securityEvents = [];



  state.activity = [];



  state.currentMain = "q0";



  state.payment = 0;



  state.paymentVehicle = null;



  state.dfaRuns = 0;



  state.nfaRuns = 0;



  state.regexRuns = 0;



  state.animating = false;





  $("#vehicleInput").value =

    "MH12AB1234";



  $("#exitVehicleInput").value =

    "";





  setIncoming(

    "—",

    "Waiting for vehicle"

  );





  setMainState(

    "q0"

  );





  clearSecurity();



  resetPayment();



  updateStats();



  renderActivity();



  renderReport();





  toast(

    "Complete simulation reset."

  );



}





/* ================= TAB SYSTEM ================= */



$$(".tab").forEach(

  tab => {



    tab.addEventListener(

      "click",

      () => {



        $$(".tab")

        .forEach(

          t =>

          t.classList.remove(

            "active"

          )

        );





        tab.classList.add(

          "active"

        );





        $$(".page")

        .forEach(

          p =>

          p.classList.remove(

            "active"

          )

        );





        $("#"+tab.dataset.tab)

        .classList.add(

          "active"

        );





        if(

          tab.dataset.tab ===

          "report"

        ){



          renderReport();



        }





        window.scrollTo({

          top:0,

          behavior:"smooth"

        });



      }

    );



  }

);





/* ================= EVENTS ================= */



$("#simulateVehicleBtn")

.addEventListener(

  "click",

  simulateVehicle

);





$("#autoVehicleBtn")

.addEventListener(

  "click",

  autoVehicle

);





$("#requestExitBtn")

.addEventListener(

  "click",

  requestExit

);





$("#runDfa")

.addEventListener(

  "click",

  runDfa

);





$("#runNfa")

.addEventListener(

  "click",

  runNfa

);





$("#runRegex")

.addEventListener(

  "click",

  runRegex

);





$$(".money button")

.forEach(

  b => {



    b.addEventListener(

      "click",

      () =>

      addPayment(

        Number(

          b.dataset.money

        )

      )

    );



  }

);





$("#completePayment")

.addEventListener(

  "click",

  completePayment

);





$("#resetPayment")

.addEventListener(

  "click",

  resetPayment

);





$("#clearSecurity")

.addEventListener(

  "click",

  clearSecurity

);





$("#reportBtn")

.addEventListener(

  "click",

  () => {



    $$(".tab")

    .forEach(

      t =>

      t.classList.toggle(

        "active",

        t.dataset.tab ===

        "report"

      )

    );





    $$(".page")

    .forEach(

      p =>

      p.classList.toggle(

        "active",

        p.id === "report"

      )

    );





    renderReport();



  }

);





$("#printReport")

.addEventListener(

  "click",

  () =>

  window.print()

);





$("#downloadReport")

.addEventListener(

  "click",

  downloadJSON

);





$("#resetBtn")

.addEventListener(

  "click",

  resetAll

);





/* ================= INPUT NORMALIZATION ================= */



$("#vehicleInput")

.addEventListener(

  "input",

  e =>

  e.target.value =

    e.target.value.toUpperCase()

);





$("#exitVehicleInput")

.addEventListener(

  "input",

  e =>

  e.target.value =

    e.target.value.toUpperCase()

);





$("#dfaInput")

.addEventListener(

  "input",

  e =>

  e.target.value =

    e.target.value.toUpperCase()

);





$("#nfaInput")

.addEventListener(

  "input",

  e =>

  e.target.value =

    e.target.value.toUpperCase()

);





/* ================= INITIALIZATION ================= */



$("#year").textContent =

  new Date().getFullYear();





setupDfa();



renderActivity();



updateStats();



renderPayment();



renderReport();



setMainState("q0");



log(

  "Advanced FAFL simulation engine initialized.",

  "ok"

);