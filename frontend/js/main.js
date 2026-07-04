


// ✅ HELPER: GET ELEMENT
function el(id){
  return document.getElementById(id);
}



/* ================= AUTH ================= */


window.authSignup = async function () {

console.log("Signup clicked");

const name = document.getElementById('reg-name').value.trim();
const role = document.getElementById('reg-role').value;
const email = document.getElementById('reg-email').value.trim();
const password = document.getElementById('reg-password').value;


if (!name || !email || password.length < 6) {

alert("Please fill all fields correctly");

return;

}


const { data, error } =
await supabaseClient.auth.signUp({

email,
password

});


if (error) {

alert("Signup Error: " + error.message);

return;

}


const user = data.user;


if (!user) {

alert("Signup failed");

return;

}


const { error: profileError } =
await supabaseClient

.from("profiles")

.upsert([{

id: user.id,
full_name: name,
role: role,
email: email

}]);


if (profileError) {

alert("Profile creation failed: " + profileError.message);

return;

}


alert("Registration successful!");

closeModals();

};


/* login */
async function authLogin(){

  const email = el("login-email").value;
  const password = el("login-password").value;


  const { error } =
  await supabase.auth.signInWithPassword({

    email,
    password

  });


  if(error){

    alert(error.message);

  }
  else{

    location.href = "dashboard.html";

  }

}
fetch(API + "auth/reset-password.php", {
  method: "POST",
  body: JSON.stringify({
    token: token,
    password: newPassword
  })
});
fetch(API + "auth/request-reset.php", {
  method: "POST",
  body: JSON.stringify({ email })
});

// ✅ CHECK USER SESSION - Returns user with metadata
async function checkUserSession(){
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function logout(){

  await supabase.auth.signOut();

  location.href="../../index.html";

}




/* ================= DASHBOARD ================= */


async function initDashboard(){

  const { data: { user } } =
  await supabase.auth.getUser();


  if(!user){

    location.href="index.html";
    return;

  }



  const { data: profiles, error } =
  await supabase

  .from("profiles")

  .select("*")

  .eq("id", user.id)

  .single();



  if(error){

    alert(error.message);
    return;

  }


  el("user-greeting").innerText =
  "Welcome " + profiles.full_name;



  if(profiles.role === "worker"){

    loadWorker(profiles);

  }
  else{

    loadEmployer(profiles);

  }

}




/* ================= WORKER ================= */


async function loadWorker(profiles){

  el("worker-section").style.display="block";

  loadJobs();

  loadMyApplications();

}



async function applyJob(jobId){

  const { data: { user } } =
  await supabase.auth.getUser();



  const { error } =
  await supabase

  .from("applications")

  .insert({

    job_id: jobId,

    worker_id: user.id,

    status:"pending"

  });



  if(error){

    alert(error.message);

  }
  else{

    alert("Applied Successfully");

  }

}




async function loadMyApplications(){

  const { data, error } =
  await supabase

  .from("applications")

  .select("*, jobs(*)");



  if(error){

    alert(error.message);
    return;

  }



  el("my-applications").innerHTML =

  data.map(a => `

  <div class="card">

  ${a.jobs.title}

  <br>

  Status: ${a.status}

  </div>

  `).join("");

}




/* ================= EMPLOYER ================= */


async function loadEmployer(profile){

  el("employer-section").style.display="block";

  loadMyJobs();

}




async function postJob(){


  const { data: { user } } =
  await supabase.auth.getUser();



  const { error } =
  await supabase

  .from("jobs")

  .insert({

    title: el("job-title").value,

    description: el("job-desc").value,

    location: el("job-location").value,

    pay: el("job-pay").value,

    employer_id: user.id

  });



  if(error){

    alert(error.message);

  }
  else{

    alert("Job Posted");

  }

}



async function loadMyJobs(){


  const { data, error } =
  await supabase

  .from("jobs")

  .select("*");



  if(error){

    alert(error.message);
    return;

  }



  el("employer-jobs").innerHTML =

  data.map(j => `

  <div>

  ${j.title}

  <button onclick="viewApplications('${j.id}')">

  Applications

  </button>

  </div>

  `).join("");

}



async function viewApplications(jobId){


  const { data, error } =
  await supabase

  .from("applications")

  .select("*, profiles(*)")

  .eq("job_id", jobId);



  if(error){

    alert(error.message);
    return;

  }



  el("applications").innerHTML =

  data.map(a => `

  <div>

  ${a.profiles.full_name}

  <button onclick="hire('${a.id}')">

  Hire

  </button>

  </div>

  `).join("");

}




async function hire(appId){


  const { error } =
  await supabase

  .from("applications")

  .update({

    status:"hired"

  })

  .eq("id", appId);



  if(error){

    alert(error.message);

  }
  else{

    alert("Worker hired");

  }

}




/* ================= JOB LIST ================= */


async function loadJobs(){


  const { data, error } =
  await supabase

  .from("jobs")

  .select("*");



  if(error){

    alert(error.message);
    return;

  }



  el("job-list").innerHTML =

  data.map(j => `

  <div>

  ${j.title}

  <button onclick="applyJob('${j.id}')">

  Apply

  </button>

  </div>

  `).join("");

}




/* ================= AVATAR ================= */


async function uploadAvatar(){


  const file =
  el("avatar").files[0];


  if(!file){

    alert("Select file");
    return;

  }



  const filePath =
  Date.now() + "_" + file.name;



  const { error } =
  await supabase.storage

  .from("avatars")

  .upload(filePath, file);



  if(error){

    alert(error.message);
    return;

  }



  const url =

  "https://wadjqsgwpzmxiwymqghs.supabase.co/storage/v1/object/public/avatars/"

  + filePath;



  const { data: { user } } =
  await supabase.auth.getUser();



  await supabase

  .from("profiles")

  .update({

    avatar_url: url

  })

  .eq("id", user.id);



  alert("Avatar uploaded");

}




/* ================= RATING ================= */


async function rateWorker(workerId){


  const rating = prompt("Rating 1-5");

  const review = prompt("Review");



  const { data: { user } } =
  await supabase.auth.getUser();



  const { error } =
  await supabase

  .from("ratings")

  .insert({

    worker_id: workerId,

    employer_id: user.id,

    rating,

    review

  });



  if(error){

    alert(error.message);

  }
  else{

    alert("Rating submitted");

  }

}
await supabase.from("messages").insert({

sender_id:user.id,

receiver_id:workerId,

message:"Hello"

});
supabase

.channel("chat")

.on(

"postgres_changes",

{

event:"INSERT",

schema:"public",

table:"messages"

},

payload=>{

console.log(payload.new.message);

}

)

.subscribe();
if(profiles.role=="admin"){

loadAllUsers();

loadAllJobs();

}
supabase.storage

.from("ids")

.upload("id.png",file)