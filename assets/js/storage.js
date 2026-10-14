/* Demo data layer. Replace this adapter with Firebase/API calls when backend is added. */
(function(){
  const KEY = "nextos_school_demo_v1";
  const initial = {
    students: [
      {id:"STU-26001",name:"Aarav Sharma",className:"Class 10-A",guardian:"Rajesh Sharma",phone:"9876543210",email:"aarav.parent@example.com",fee:12000,paid:12000,status:"Active",joined:"2026-04-05"},
      {id:"STU-26002",name:"Ananya Verma",className:"Class 9-B",guardian:"Sanjay Verma",phone:"9876543211",email:"ananya.parent@example.com",fee:12000,paid:8000,status:"Active",joined:"2026-04-06"},
      {id:"STU-26003",name:"Vihaan Gupta",className:"Class 8-A",guardian:"Amit Gupta",phone:"9876543212",email:"vihaan.parent@example.com",fee:10000,paid:10000,status:"Active",joined:"2026-04-07"},
      {id:"STU-26004",name:"Isha Singh",className:"Class 10-B",guardian:"Pawan Singh",phone:"9876543213",email:"isha.parent@example.com",fee:12000,paid:6000,status:"Active",joined:"2026-04-08"},
      {id:"STU-26005",name:"Aditya Mishra",className:"Class 7-A",guardian:"Deepak Mishra",phone:"9876543214",email:"aditya.parent@example.com",fee:9000,paid:9000,status:"Active",joined:"2026-04-09"},
      {id:"STU-26006",name:"Meera Patel",className:"Class 6-B",guardian:"Kunal Patel",phone:"9876543215",email:"meera.parent@example.com",fee:8500,paid:4000,status:"Active",joined:"2026-04-10"},
      {id:"STU-26007",name:"Kabir Yadav",className:"Class 9-A",guardian:"Rohit Yadav",phone:"9876543216",email:"kabir.parent@example.com",fee:12000,paid:12000,status:"Active",joined:"2026-04-11"},
      {id:"STU-26008",name:"Sara Khan",className:"Class 8-B",guardian:"Imran Khan",phone:"9876543217",email:"sara.parent@example.com",fee:10000,paid:5000,status:"Inactive",joined:"2026-04-12"}
    ],
    teachers: [
      {id:"TCH-001",name:"Neha Srivastava",subject:"Mathematics",phone:"9810012345",email:"neha@sunrise.demo",className:"Class 10-A",salary:32000,status:"Active"},
      {id:"TCH-002",name:"Rahul Pandey",subject:"Science",phone:"9810012346",email:"rahul@sunrise.demo",className:"Class 9-B",salary:30000,status:"Active"},
      {id:"TCH-003",name:"Pooja Singh",subject:"English",phone:"9810012347",email:"pooja@sunrise.demo",className:"Class 8-A",salary:28000,status:"Active"},
      {id:"TCH-004",name:"Manish Kumar",subject:"Social Studies",phone:"9810012348",email:"manish@sunrise.demo",className:"Class 7-A",salary:27000,status:"Active"}
    ],
    classes: [
      {id:"CLS-01",className:"Class 10",section:"A",teacher:"Neha Srivastava",room:"201",students:32},
      {id:"CLS-02",className:"Class 10",section:"B",teacher:"Neha Srivastava",room:"202",students:30},
      {id:"CLS-03",className:"Class 9",section:"A",teacher:"Rahul Pandey",room:"105",students:35},
      {id:"CLS-04",className:"Class 9",section:"B",teacher:"Rahul Pandey",room:"106",students:33},
      {id:"CLS-05",className:"Class 8",section:"A",teacher:"Pooja Singh",room:"103",students:29},
      {id:"CLS-06",className:"Class 7",section:"A",teacher:"Manish Kumar",room:"101",students:31}
    ],
    attendance: [],
    fees: [
      {id:"FEE-001",student:"Aarav Sharma",studentId:"STU-26001",month:"October 2026",amount:1000,paid:1000,date:"2026-10-02",status:"Paid"},
      {id:"FEE-002",student:"Ananya Verma",studentId:"STU-26002",month:"October 2026",amount:1000,paid:500,date:"2026-10-04",status:"Partial"},
      {id:"FEE-003",student:"Isha Singh",studentId:"STU-26004",month:"October 2026",amount:1000,paid:0,date:"—",status:"Pending"},
      {id:"FEE-004",student:"Meera Patel",studentId:"STU-26006",month:"October 2026",amount:850,paid:0,date:"—",status:"Pending"},
      {id:"FEE-005",student:"Kabir Yadav",studentId:"STU-26007",month:"October 2026",amount:1000,paid:1000,date:"2026-10-03",status:"Paid"}
    ],
    exams: [
      {id:"EX-001",name:"Half-Yearly Examination",className:"Classes 6–10",startDate:"2026-10-20",endDate:"2026-10-28",status:"Upcoming"},
      {id:"EX-002",name:"Unit Test II",className:"Classes 6–10",startDate:"2026-09-10",endDate:"2026-09-12",status:"Published"}
    ],
    homework: [
      {id:"HW-001",title:"Algebra practice worksheet",className:"Class 10-A",subject:"Mathematics",dueDate:"2026-10-16",status:"Active"},
      {id:"HW-002",title:"Chapter 5 reading notes",className:"Class 9-B",subject:"English",dueDate:"2026-10-17",status:"Active"},
      {id:"HW-003",title:"Science diagrams",className:"Class 8-A",subject:"Science",dueDate:"2026-10-18",status:"Active"}
    ],
    timetable: [
      {id:"TT-001",className:"Class 10-A",day:"Monday",time:"09:00–09:45",subject:"Mathematics",teacher:"Neha Srivastava"},
      {id:"TT-002",className:"Class 10-A",day:"Monday",time:"09:45–10:30",subject:"Science",teacher:"Rahul Pandey"},
      {id:"TT-003",className:"Class 9-B",day:"Monday",time:"10:30–11:15",subject:"English",teacher:"Pooja Singh"}
    ],
    transport: [
      {id:"BUS-01",route:"Route A — Town Centre",vehicle:"UP 57 AB 1024",driver:"Ramesh Yadav",students:28,status:"Active"},
      {id:"BUS-02",route:"Route B — Railway Road",vehicle:"UP 57 CD 2048",driver:"Suresh Kumar",students:24,status:"Active"}
    ],
    library: [
      {id:"LIB-001",title:"Mathematics — Class 10",author:"R. D. Sharma",copies:12,available:8},
      {id:"LIB-002",title:"Wings of Fire",author:"A. P. J. Abdul Kalam",copies:8,available:5},
      {id:"LIB-003",title:"The Blue Umbrella",author:"Ruskin Bond",copies:10,available:7}
    ],
    notices: [
      {id:"NTC-001",title:"Half-Yearly examination schedule",body:"The half-yearly examination will begin from 20 October 2026. Please check the examination section for details.",audience:"All students & parents",date:"2026-10-12",status:"Published"},
      {id:"NTC-002",title:"School closed on Sunday",body:"The school campus will remain closed on Sunday. Regular classes resume on Monday.",audience:"All school users",date:"2026-10-10",status:"Published"}
    ],
    users: [
      {id:"USR-001",name:"School Admin",email:"admin@sunrise.demo",role:"Administrator",status:"Active"},
      {id:"USR-002",name:"Neha Srivastava",email:"neha@sunrise.demo",role:"Teacher",status:"Active"},
      {id:"USR-003",name:"Rajesh Sharma",email:"aarav.parent@example.com",role:"Parent",status:"Active"}
    ],
    settings: {schoolName:"Sunrise Public School",address:"Kushinagar, Uttar Pradesh, India",phone:"+91 98765 43210",email:"office@sunrise.demo",academicYear:"2026–27",currency:"INR"}
  };
  function clone(x){return JSON.parse(JSON.stringify(x))}
  function load(){try{const saved=localStorage.getItem(KEY);return saved?Object.assign(clone(initial),JSON.parse(saved)):clone(initial)}catch(e){return clone(initial)}}
  let db=load();
  const api={
    getAll: async key => clone(db[key]||[]),
    get: async (key,id) => clone((db[key]||[]).find(x=>x.id===id)||null),
    create: async (key,item) => {if(!db[key])db[key]=[];const row={...item,id:item.id||`${key.slice(0,3).toUpperCase()}-${Date.now().toString().slice(-6)}`};db[key].unshift(row);persist();return clone(row)},
    update: async (key,id,patch) => {const i=(db[key]||[]).findIndex(x=>x.id===id);if(i<0)throw Error("Record not found");db[key][i]={...db[key][i],...patch};persist();return clone(db[key][i])},
    remove: async (key,id) => {db[key]=(db[key]||[]).filter(x=>x.id!==id);persist();return true},
    settings: async () => clone(db.settings),
    updateSettings: async patch => {db.settings={...db.settings,...patch};persist();return clone(db.settings)},
    reset: async () => {db=clone(initial);persist();return true},
    exportData: () => clone(db),
    importData: data => {db={...clone(initial),...data};persist()},
    mode: "local-demo"
  };
  function persist(){try{localStorage.setItem(KEY,JSON.stringify(db))}catch(e){console.warn("Demo data could not be saved",e)}}
  window.SchoolStore=api;
})();
