const express = require('express');
const admin = require('firebase-admin');
const path = require('path');

const app = express();
app.use(express.json());

// Servir la página web de forma estática en la red local
app.use(express.static(path.join(__dirname)));

// Inicializar Firebase Admin usando la misma llave serviceAccountKey.json de Eclipse
const serviceAccount = require("./serviceAccountKey.json");

if (admin.apps.length === 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
console.log("☁️ Conexión nativa establecida exitosamente con Firestore.");

// --- ENDPOINT: LISTAR TODAS LAS ELECCIONES ---
app.get('/api/elecciones', async (req, res) => {
    try {
        const snapshot = await db.collection('elecciones').get();
        const elecciones = [];
        snapshot.forEach(doc => {
            elecciones.push({ id: doc.id, ...doc.data() });
        });
        res.json(elecciones);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT: VALIDAR ALUMNO Y DOBLE VOTO ---
app.post('/api/ingresar', async (req, res) => {
    const { dni, eleccionId } = req.body;
    try {
        // CORREGIDO: Se utilizó .doc() en lugar de .document()
        const votanteDoc = await db.collection('padron').doc(dni).get();
        if (!votanteDoc.exists) {
            return res.status(404).json({ error: "El DNI ingresado NO figura en el padrón." });
        }

        // CORREGIDO: Se utilizó .doc() en lugar de .document()
        const votoEmitidoDoc = await db.collection('elecciones').doc(eleccionId)
                                       .collection('votos_emitidos').doc(dni).get();
        if (votoEmitidoDoc.exists) {
            return res.status(403).json({ error: `El estudiante ${votanteDoc.data().nombre} ya votó en esta elección.` });
        }

        res.json({ dni: votanteDoc.id, ...votanteDoc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT: TRAER CANDIDATOS ---
app.get('/api/candidatos/:eleccionId', async (req, res) => {
    const { eleccionId } = req.params;
    try {
        // CORREGIDO: Se utilizó .doc() en lugar de .document()
        const snapshot = await db.collection('elecciones').doc(eleccionId).collection('candidatos').get();
        const candidatos = [];
        snapshot.forEach(doc => {
            candidatos.push(doc.data());
        });
        res.json(candidatos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ENDPOINT: EMITIR VOTO SEGURO ---
app.post('/api/votar', async (req, res) => {
    const { dni, eleccionId, nombreLista } = req.body;
    try {
        const batch = db.batch();
        // CORREGIDO: Se utilizó .doc() en lugar de .document()
        const eleccionRef = db.collection('elecciones').doc(eleccionId);

        if (nombreLista) {
            // CORREGIDO: Se utilizó .doc() en lugar de .document()
            const candRef = eleccionRef.collection('candidatos').doc(nombreLista);
            batch.update(candRef, { votos: admin.firestore.FieldValue.increment(1) });
        } else {
            // CORREGIDO: Se utilizó .doc() en lugar de .document()
            const blancoRef = eleccionRef.collection('configuracion').doc('votos_blanco');
            batch.set(blancoRef, { cantidad: admin.firestore.FieldValue.increment(1) }, { merge: true });
        }

        // CORREGIDO: Se utilizó .doc() en lugar de .document()
        const registroVotoRef = eleccionRef.collection('votos_emitidos').doc(dni);
        batch.set(registroVotoRef, { votoEmitido: true });

        await batch.commit();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000; // Usa el puerto de la nube o el 3000 si estás local
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor multidispositivo activo en el puerto ${PORT}`);
});
