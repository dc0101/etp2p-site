function openSignUp() {
  $("modalTitle").textContent = "Create Etp2p Account";
  $("modalBody").innerHTML = `
    <p class="sec-note">For escrow & transaction security, your bank account name must match your legal full name.</p>
    
    <label class="label" for="regEmail">Email address</label>
    <div class="entry"><input id="regEmail" type="email" placeholder="you@example.com"></div>
    
    <label class="label" for="regPassword">Password (min 6 characters)</label>
    <div class="entry"><input id="regPassword" type="password" placeholder="••••••••"></div>

    <label class="label" for="regFullName">Full Legal Name (Must match Bank Account)</label>
    <div class="entry"><input id="regFullName" type="text" placeholder="Abebe Kebede"></div>

    <label class="label" for="regBankName">Bank Account Name</label>
    <div class="entry"><input id="regBankName" type="text" placeholder="Abebe Kebede (Exact match required)"></div>

    <label class="label" for="regCountry">Country</label>
    <div class="entry"><input id="regCountry" type="text" value="Ethiopia"></div>

    <label class="label" for="regAddress">Physical Address</label>
    <div class="entry"><input id="regAddress" type="text" placeholder="Bole, Addis Ababa"></div>
  `;
  $("modalFoot").innerHTML = `<button class="btn primary" id="submitSignUp">Register Account</button>`;

  $("submitSignUp").onclick = async () => {
    const email = $("regEmail").value.trim();
    const password = $("regPassword").value;
    const fullName = $("regFullName").value.trim();
    const bankName = $("regBankName").value.trim();
    const country = $("regCountry").value.trim();
    const address = $("regAddress").value.trim();

    if (!email || !password || !fullName || !bankName) {
      return notify("Please fill in all required fields.");
    }

    if (fullName.toLowerCase() !== bankName.toLowerCase()) {
      return notify("Security Error: Full Legal Name must match Bank Account Name to prevent scams.");
    }

    if (password.length < 6) {
      return notify("Password must be at least 6 characters.");
    }

    // Sign up with Supabase Auth and store profile metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          bank_account_name: bankName,
          country: country,
          address: address,
          public_handle: fullName
        }
      }
    });

    if (error) {
      notify(error.message);
    } else {
      // Also upsert into profiles table if available
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          public_handle: fullName,
          full_name: fullName,
          bank_account_name: bankName,
          country: country,
          address: address
        });
      }
      notify("Account created successfully! Please sign in.");
      closeModal();
      openSignIn();
    }
  };

  $("modal").classList.add("show");
}

async function openProfile() {
  if (!authUser) {
    notify("Please sign in to view your profile.");
    openSignIn();
    return;
  }

  // Fetch latest profile data from Supabase
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .single();

  const meta = authUser.user_metadata || {};
  const fullName = profile?.full_name || meta.full_name || "Not set";
  const bankName = profile?.bank_account_name || meta.bank_account_name || "Not set";
  const country = profile?.country || meta.country || "Ethiopia";
  const address = profile?.address || meta.address || "Not set";

  $("modalTitle").textContent = "User Profile & Security Verification";
  $("modalBody").innerHTML = `
    <p class="sec-note">Verified merchant profile details for secure P2P trading.</p>
    <div class="summary" style="margin-bottom:8px;"><div><b>Email:</b> ${esc(authUser.email)}</div></div>
    <div class="summary" style="margin-bottom:8px;"><div><b>Full Name:</b> ${esc(fullName)}</div></div>
    <div class="summary" style="margin-bottom:8px;"><div><b>Bank Account Name:</b> <span style="color:var(--green); font-weight:700;">${esc(bankName)}</span></div></div>
    <div class="summary" style="margin-bottom:8px;"><div><b>Country:</b> ${esc(country)}</div></div>
    <div class="summary"><div><b>Address:</b> ${esc(address)}</div></div>
    <p class="hint" style="margin-top:12px;">🔒 Verified: Bank account name matches legal identity.</p>
  `;
  $("modalFoot").innerHTML = `<button class="btn outline" onclick="document.getElementById('modal').classList.remove('show')">Close</button>`;
  $("modal").classList.add("show");
}
