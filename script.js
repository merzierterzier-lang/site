// ...nouveau fichier...
(function(){
	// Utilitaires simples
	const qs = id => document.getElementById(id);
	const showMsg = (id, txt, timeout=3000) => {
		const el = qs(id);
		if(!el) return;
		el.textContent = txt;
		setTimeout(()=>{ if(el) el.textContent = ''; }, timeout);
	};

	// Simple navigation
	window.showPage = function(page){
		document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
		const el = qs(page);
		if(el) el.classList.add('active');
		// show dashboard default tab if needed
		if(page === 'dashboard') showDashboardTab('account');
	};

	window.showDashboardTab = function(tab){
		document.querySelectorAll('.menu-item').forEach(btn => btn.classList.remove('active'));
		// highlight matching sidebar button
		const map = { account:0, keys:1, generate:2, admin:3 };
		document.querySelectorAll('.menu-item')[map[tab]||0]?.classList.add('active');

		document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
		const el = qs('tab-'+tab);
		if(el) el.classList.add('active');
	};

	// HWID
	function makeHwid(){
		return 'hwid-' + Math.random().toString(36).slice(2,12);
	}
	window.regenerateHWID = function(){
		const hw = makeHwid();
		localStorage.setItem('deviceHwid', hw);
		qs('deviceHwid').textContent = hw;
		showMsg('activateMsg','HWID régénéré',2000);
	};
	window.copyHWID = function(){ navigator.clipboard?.writeText(qs('deviceHwid').textContent || ''); showMsg('activateMsg','HWID copié'); };

	// Local "database"
	function loadUsers(){ return JSON.parse(localStorage.getItem('users') || '[]'); }
	function saveUsers(u){ localStorage.setItem('users', JSON.stringify(u)); }
	function setCurrent(user){ localStorage.setItem('currentUser', JSON.stringify(user)); updateAccountInfo(); }
	function getCurrent(){ return JSON.parse(localStorage.getItem('currentUser') || 'null'); }
	function clearCurrent(){ localStorage.removeItem('currentUser'); updateAccountInfo(); }

	// Update dashboard info
	function updateAccountInfo(){
		const u = getCurrent();
		qs('accUserId').textContent = u ? (u.id||'-') : '-';
		qs('accUsername').textContent = u ? u.username : '-';
		qs('accType').textContent = u ? (u.type||'User') : '-';
		qs('accExpires').textContent = u ? (u.expires||'Never') : '-';
		qs('accKey').textContent = u ? (u.key||'-') : '-';
		qs('accHWID').textContent = u ? (u.hwid||'-') : '-';
	}

	// Password toggle
	window.togglePassword = function(id){
		const el = qs(id);
		if(!el) return;
		el.type = el.type === 'password' ? 'text' : 'password';
	};

	// Signup
	window.signup = function(){
		const username = qs('signupUsername').value.trim();
		const password = qs('signupPassword').value;
		const confirm = qs('signupConfirm').value;
		const key = qs('licenseKey').value.trim();

		if(!username || !password){ showMsg('signupError','Nom et mot de passe requis'); return; }
		if(password !== confirm){ showMsg('signupError','Les mots de passe ne correspondent pas'); return; }

		const users = loadUsers();
		if(users.find(x=>x.username===username)){ showMsg('signupError','Nom déjà utilisé'); return; }
		const user = { id: 'u'+Date.now(), username, password, type: key? 'licensed' : 'free', key: key||'-', expires: key? 'lifetime' : '-', hwid: localStorage.getItem('deviceHwid') || makeHwid() };
		users.push(user);
		saveUsers(users);
		setCurrent(user);
		showPage('dashboard');
		showMsg('signupError','Compte créé et connecté',2000);
	};

	// Login
	window.login = function(){
		const username = qs('loginUsername').value.trim();
		const password = qs('loginPassword').value;
		const users = loadUsers();
		const user = users.find(u => u.username === username && u.password === password);
		if(!user){ showMsg('loginError','Identifiants incorrects'); return; }
		// attach HWID
		user.hwid = localStorage.getItem('deviceHwid') || makeHwid();
		saveUsers(users);
		setCurrent(user);
		showPage('dashboard');
		showMsg('loginError','Connecté',2000);
	};

	// Logout
	window.logout = function(){
		clearCurrent();
		showPage('home');
	};

	// Account generation pool (exemples)
	const accountPool = [
		{ username: 'fivem_user01', password: 'Pass#01' },
		{ username: 'fivem_user02', password: 'Pass#02' },
		{ username: 'fivem_user03', password: 'Pass#03' },
		{ username: 'fivem_user04', password: 'Pass#04' }
	];

	// Show generated account in UI
	function displayGenerated(account){
		qs('accountText').textContent = `${account.username} : ${account.password}`;
		qs('accountDisplay').classList.remove('hidden');
		qs('accountEmpty').classList.add('hidden');
	}

	// Copy account
	window.copyAccount = function(){
		const txt = qs('accountText').textContent || '';
		navigator.clipboard?.writeText(txt);
		showMsg('generateMsg','Compte copié');
	};

	// Regenerate preview (local)
	window.regenAccountPreview = function(){
		const acc = accountPool[Math.floor(Math.random()*accountPool.length)];
		displayGenerated(acc);
	};

	// Generate account flow: disconnect then auto-connect with generated account
	window.generateAccount = function(){
		const current = getCurrent();
		if(!current){ showMsg('generateMsg','Connectez-vous d’abord'); return; }

		// pick account
		const acc = accountPool[Math.floor(Math.random()*accountPool.length)];
		displayGenerated(acc);
		showMsg('generateMsg','Compte généré — déconnexion en cours...', 3000);

		// Perform disconnect then auto-login sequence
		setTimeout(()=>{
			// disconnect
			clearCurrent();
			showPage('home');
			showMsg('generateMsg','Déconnecté. Reconnexion automatique...', 2000);

			// simulate a short delay then "login" with generated account
			setTimeout(()=>{
				// create/update user record for the generated account
				const users = loadUsers();
				let user = users.find(u=>u.username === acc.username);
				if(!user){
					user = { id:'gen'+Date.now(), username: acc.username, password: acc.password, type:'generated', key:'-', expires:'-', hwid: localStorage.getItem('deviceHwid') || makeHwid() };
					users.push(user);
				} else {
					user.password = acc.password;
					user.hwid = localStorage.getItem('deviceHwid') || makeHwid();
				}
				saveUsers(users);
				// set as current user (auto-login)
				setCurrent(user);
				showPage('dashboard');
				showMsg('generateMsg','Reconnecté avec le compte généré',3000);
			}, 1500);
		}, 1200);
	};

	// Admin/key helpers (minimal)
	window.genKeyAdmin = function(){
		const pass = qs('adminPassword').value || '';
		if(pass !== 'admin') { showMsg('adminMsg','Mot de passe admin invalide'); return; }
		const type = qs('keyType').value;
		const key = `${type}-${Math.random().toString(36).slice(2,10)}`;
		qs('keyText').textContent = key;
		qs('keyDisplay').classList.remove('hidden');
		showMsg('adminMsg','Clé générée');
	};
	window.copyKey = function(){ navigator.clipboard?.writeText(qs('keyText').textContent || ''); showMsg('adminMsg','Clé copiée'); };

	// Initial setup
	(function init(){
		if(!localStorage.getItem('deviceHwid')) localStorage.setItem('deviceHwid', makeHwid());
		qs('deviceHwid').textContent = localStorage.getItem('deviceHwid');
		updateAccountInfo();
		// quick preview sample
		qs('accountText').textContent = '-';
	})();
})();