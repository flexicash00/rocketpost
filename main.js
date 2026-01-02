// --- 1. GLOBAL STAFF SECURITY (RUNS IMMEDIATELY) ---
(function() {
    const STAFF_PIN = "7712"; // Boss, change this to your secret code!
    const isProtectedPage = window.location.pathname.includes("admin.html");

    if (isProtectedPage) {
        if (sessionStorage.getItem('staff_auth') !== 'true') {
            let entry = prompt("ROCKET POST | Internal Staff Access\nPlease enter Security PIN:");
            if (entry === STAFF_PIN) {
                sessionStorage.setItem('staff_auth', 'true');
            } else {
                alert("Access Denied.");
                window.location.href = "index.html";
            }
        }
    }
})();

// --- 2. FIREBASE CONFIGURATION (Your Specific Keys) ---
const firebaseConfig = {
  apiKey: "AIzaSyDTiUE0uXYFL7EnpXuwz983_sgyDkABxEc",
  authDomain: "rocketpost-bfedf.firebaseapp.com",
  databaseURL: "https://rocketpost-bfedf-default-rtdb.firebaseio.com",
  projectId: "rocketpost-bfedf",
  storageBucket: "rocketpost-bfedf.firebasestorage.app",
  messagingSenderId: "71513119566",
  appId: "1:71513119566:web:d6ee8d8ebef3fd845c9c1f"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

document.addEventListener("DOMContentLoaded", () => {
    
    // --- 3. THE ADMIN REVEAL ---
    if (window.location.pathname.includes("admin.html") && sessionStorage.getItem('staff_auth') === 'true') {
        document.body.classList.remove("auth-hidden");
    }

    // --- 4. MOBILE HAMBURGER TOGGLE ---
    const hamburger = document.getElementById("hamburger");
    const navMenu = document.getElementById("navMenu");
    if (hamburger) {
        hamburger.addEventListener("click", () => {
            navMenu.classList.toggle("active");
            hamburger.classList.toggle("is-active");
        });
    }

    // --- 5. TRANSLATION DICTIONARY ---
    const i18n = {
        en: {
            nav_track: "Track",
            nav_contact: "Contact Us",
            track_title: "Track Your Shipment",
            track_sub: "Real-time updates for your global deliveries.",
            btn_track: "Track Now",
            label_sender: "Sender",
            label_receiver: "Receiver",
            label_dest: "Destination",
            label_loc: "Current Location",
            label_update: "Latest Update",
            label_eta: "Expected Delivery (ETA)",
            status_registered: "Registered",
            status_transit: "In Transit",
            status_out: "Out for Delivery",
            status_delivered: "Delivered",
            status_hold: "On Hold",
            err_not_found: "Tracking Number Not Found!",
            admin_success: "Success! Global Tracking ID:"
        },
        de: {
            nav_track: "Verfolgen",
            nav_contact: "Kontakt",
            track_title: "Sendung Verfolgen",
            track_sub: "Echtzeit-Updates für Ihre weltweiten Lieferungen.",
            btn_track: "Jetzt Verfolgen",
            label_sender: "Absender",
            label_receiver: "Empfänger",
            label_dest: "Zielort",
            label_loc: "Aktueller Standort",
            label_update: "Letztes Update",
            label_eta: "Voraussichtliche Zustellung",
            status_registered: "Registriert",
            status_transit: "In Zustellung",
            status_out: "In Auslieferung",
            status_delivered: "Zugestellt",
            status_hold: "Angehalten",
            err_not_found: "Sendungsnummer nicht gefunden!",
            admin_success: "Erfolg! Sendungsnummer:"
        },
        fr: {
            nav_track: "Suivre",
            nav_contact: "Contact",
            track_title: "Suivre votre colis",
            track_sub: "Mises à jour en temps réel pour vos livraisons.",
            btn_track: "Suivre maintenant",
            label_sender: "Expéditeur",
            label_receiver: "Destinataire",
            label_dest: "Destination",
            label_loc: "Localisation actuelle",
            label_update: "Dernière mise à jour",
            label_eta: "Livraison prévue",
            status_registered: "Enregistré",
            status_transit: "En transit",
            status_out: "En cours de livraison",
            status_delivered: "Livré",
            status_hold: "En attente",
            err_not_found: "Numéro de suivi introuvable !",
            admin_success: "Succès ! Numéro de suivi :"
        }
    };

    // --- 6. LANGUAGE SWITCHER LOGIC ---
    let currentLang = localStorage.getItem("rocketLang") || "en";

    function changeLanguage(lang) {
        currentLang = lang;
        localStorage.setItem("rocketLang", lang);
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.getAttribute("data-i18n");
            if (i18n[lang][key]) {
                if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
                    el.placeholder = i18n[lang][key];
                } else {
                    el.innerText = i18n[lang][key];
                }
            }
        });
    }

    const langSelect = document.getElementById("langSelect");
    if (langSelect) {
        langSelect.value = currentLang;
        langSelect.addEventListener("change", (e) => changeLanguage(e.target.value));
    }
    changeLanguage(currentLang);

    // --- 7. MOVEMENT SIMULATION & STATIC ETA (Timezone Fix) ---
    function simulateMovement(shipment) {
        const shipDate = new Date(shipment.shipDate + 'T00:00:00');
        const today = new Date();
        const diffDays = Math.ceil(Math.abs(today - shipDate) / (1000 * 60 * 60 * 24));

        const etaDate = new Date(shipment.shipDate + 'T00:00:00');
        etaDate.setDate(etaDate.getDate() + 4);
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        shipment.expectedDelivery = etaDate.toLocaleDateString('en-US', options);

        if (shipment.isManualUpdate) return shipment;

        if (shipment.scheduledHoldDay && diffDays >= shipment.scheduledHoldDay) {
            shipment.status = "hold";
            shipment.updateMessage = shipment.scheduledHoldReason || "Held for inspection";
            shipment.currentLocation = "Customs Hub";
            return shipment;
        }

        const path = ["Origin Facility", "Regional Hub", "Sorting Center", "International Hub", "Out for Delivery", "Delivered"];
        let step = Math.min(diffDays, path.length - 1);
        shipment.currentLocation = path[step];
        
        if (step === 0) shipment.status = "registered";
        else if (step < 4) shipment.status = "transit";
        else if (step === 4) shipment.status = "out";
        else shipment.status = "delivered";

        shipment.updateMessage = `Package is arriving at ${shipment.currentLocation}`;
        return shipment;
    }

    // --- 8. TRACKING UI (FIREBASE FETCH) ---
    const trackBtn = document.getElementById("trackBtn");
    if (trackBtn) {
        trackBtn.addEventListener("click", () => {
            const input = document.getElementById("trackInput").value.trim();
            if(!input) return;

            db.ref('shipments/' + input).once('value').then((snapshot) => {
                if (snapshot.exists()) {
                    let shipment = snapshot.val();
                    shipment = simulateMovement(shipment);
                    
                    document.getElementById("resultContainer").style.display = "block";
                    const statusKey = `status_${shipment.status.toLowerCase()}`;
                    document.getElementById("resStatus").innerText = i18n[currentLang][statusKey] || shipment.status;
                    document.getElementById("resTrackingID").innerText = shipment.tracking;
                    document.getElementById("resSender").innerText = shipment.senderName;
                    document.getElementById("resReceiver").innerText = shipment.receiverName;
                    document.getElementById("resAddress").innerText = shipment.receiverAddress;
                    document.getElementById("resLocation").innerText = shipment.currentLocation;
                    document.getElementById("resETA").innerText = shipment.expectedDelivery;
                    document.getElementById("resMessage").innerText = shipment.updateMessage;

                    updateUIProgress(shipment.status);
                } else {
                    alert(i18n[currentLang].err_not_found);
                }
            });
        });
    }

    // --- 9. ADMIN: SAVE & UPDATE (FIREBASE) ---
    const adminForm = document.getElementById("adminForm");
    if (adminForm) {
        adminForm.addEventListener("submit", (e) => {
            e.preventDefault();
            const tracking = `RP-${Math.floor(100000 + Math.random() * 900000)}`;
            const shipment = {
                tracking: tracking,
                senderName: document.getElementById("senderName").value,
                senderAddress: document.getElementById("senderAddress").value,
                receiverName: document.getElementById("receiverName").value,
                receiverAddress: document.getElementById("receiverAddress").value,
                shipDate: document.getElementById("shipDate").value,
                status: document.getElementById("status").value,
                isManualUpdate: false,
                scheduledHoldDay: document.getElementById("holdDay").value ? Number(document.getElementById("holdDay").value) : null,
                scheduledHoldReason: document.getElementById("scheduledHoldReason").value || "Held for Inspection",
                updateMessage: "Shipment Registered Successfully"
            };

            db.ref('shipments/' + tracking).set(shipment).then(() => {
                document.getElementById("adminResult").innerHTML = `${i18n[currentLang].admin_success} <strong>${tracking}</strong>`;
                document.getElementById("adminResult").style.display = "block";
                adminForm.reset();
            });
        });
    }

    const btnFind = document.getElementById("btnFind");
    if (btnFind) {
        btnFind.addEventListener("click", () => {
            const trackID = document.getElementById("updateSearch").value.trim();
            db.ref('shipments/' + trackID).once('value').then((snapshot) => {
                if (snapshot.exists()) {
                    const found = snapshot.val();
                    document.getElementById("updateFields").style.display = "block";
                    document.getElementById("updateStatus").value = found.status;
                    document.getElementById("updateLocation").value = found.currentLocation || "";
                    document.getElementById("updateMsg").value = found.updateMessage || "";
                    alert("Package found in Cloud!");
                } else {
                    alert("ID not found.");
                }
            });
        });
    }

    const btnUpdateSave = document.getElementById("btnUpdateSave");
    if (btnUpdateSave) {
        btnUpdateSave.addEventListener("click", () => {
            const trackID = document.getElementById("updateSearch").value.trim();
            const updates = {
                status: document.getElementById("updateStatus").value,
                currentLocation: document.getElementById("updateLocation").value,
                updateMessage: document.getElementById("updateMsg").value,
                isManualUpdate: true
            };
            db.ref('shipments/' + trackID).update(updates).then(() => {
                alert("Cloud Sync Complete!");
            });
        });
    }

    function updateUIProgress(status) {
        const steps = ["registered", "transit", "out", "delivered"];
        const fill = document.getElementById("progressFill");
        document.querySelectorAll(".step").forEach(s => s.classList.remove("active", "on-hold-active"));
        if (status === "hold") {
            fill.style.width = "40%"; fill.classList.add("hold-pulse");
            document.getElementById("step-transit").classList.add("on-hold-active");
            document.getElementById("step-registered").classList.add("active");
        } else {
            fill.classList.remove("hold-pulse");
            const currentIndex = steps.indexOf(status);
            fill.style.width = `${((currentIndex + 1) / steps.length) * 100}%`;
            fill.style.background = "#28a745";
            for (let i = 0; i <= currentIndex; i++) document.getElementById(`step-${steps[i]}`).classList.add("active");
        }
    }
});