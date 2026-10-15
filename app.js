function openProfile() {
  if (!authUser) {
    notify("Please sign in to view your profile.");
    openSignIn();
    return;
  }
  
  $("modalTitle").textContent = "User Profile";
  $("modalBody").innerHTML = `
    <p class="sec-note">Your personal marketplace profile information.</p>
    <div class="summary" style="margin-bottom:12px;"><div><b>Email:</b> ${esc(authUser.email)}</div></div>
    <div class="summary"><div><b>User ID:</b> ${esc(authUser.id)}</div></div>
  `;
  $("modalFoot").innerHTML = `<button class="btn outline" onclick="document.getElementById('modal').classList.remove('show')">Close</button>`;
  $("modal").classList.add("show");
}

function openSecurity() {
  if (!authUser) {
    notify("Please sign in to view security settings.");
    openSignIn();
    return;
  }
  $("modalTitle").textContent = "Account Security";
  $("modalBody").innerHTML = `
    <p class="sec-note">Manage your credentials and password settings.</p>
    <div class="summary" style="margin-bottom:12px;"><div><b>Email:</b> ${esc(authUser.email)}</div></div>
    <label class="label" for="newPasswordInput">Change Password</label>
    <div class="entry"><input id="newPasswordInput" type="password" placeholder="Enter new password (min 6 chars)"></div>
  `;
  $("modalFoot").innerHTML = `
    <button class="btn primary" id="updatePasswordBtn" style="margin-bottom:8px;">Update Password</button>
    <button class="btn outline" id="signOutBtn">Sign Out</button>
  `;

  $("updatePasswordBtn").onclick = async () => {
    const password = $("newPasswordInput").value;
    if (!password || password.length < 6) {
      return notify("Password must be at least 6 characters.");
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      notify(error.message);
    } else {
      notify("Password successfully updated!");
      closeModal();
    }
  };

  $("signOutBtn").onclick = async () => {
    await supabase.auth.signOut();
    notify("Signed out successfully.");
    closeModal();
    location.reload();
  };
  
  $("modal").classList.add("show");
}

function openSignIn() {
  $("modalTitle").textContent = "Sign in to Etp2p";
  $("modalBody").innerHTML = `
    <p class="sec-note">Sign in with your email address or magic link.</p>
    <label class="label" for="emailInput">Email address</label>
    <div class="entry"><input id="emailInput" type="email" placeholder="you@example.com"></div>
    <div style="margin-top:12px; text-align:right;">
      <a href="#" id="forgotPasswordLink" style="font-size:11px; color:var(--green); font-weight:700;">Forgot password?</a>
    </div>
  `;
  $("modalFoot").innerHTML = `<button class="btn primary" id="sendMagicLink">Send Sign-In Link</button>`;
  
  $("forgotPasswordLink").onclick = async (e) => {
    e.preventDefault();
    const email = $("emailInput").value.trim();
    if (!email) {
      return notify("Please enter your email address above first.");
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: AUTH_REDIRECT,
    });
    if (error) {
      notify(error.message);
    } else {
      notify("Password recovery instructions sent to your email!");
      closeModal();
    }
  };

  $("sendMagicLink").onclick = async () => {
    const email = $("emailInput").value.trim();
    if (!email) return notify("Please enter your email.");
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: AUTH_REDIRECT } });
    if (error) notify(error.message);
    else {
      notify("Sign-in link sent to your email!");
      closeModal();
    }
  };
  $("modal").classList.add("show");
}
