import Stripe from 'stripe';
import admin from 'firebase-admin';

// Inicializa o Firebase Admin garantindo que não duplicará em ambiente Serverless
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
    });
}
const db = admin.firestore();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
});

// A Vercel precisa que o body não seja "parsed" pelo Express para podermos usar o raw-body na assinatura do Stripe
export const config = {
    api: {
        bodyParser: false,
    },
};

// Transforma o array buffer do Next/Vercel raw-body no Node Buffer
async function buffer(readable) {
    const chunks = [];
    for await (const chunk of readable) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    return Buffer.concat(chunks);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const buf = await buffer(req);
    const signature = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(buf, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error(`⚠️  Webhook signature verification failed.`, err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Processa os eventos principais
    if (['checkout.session.completed', 'customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
        const sessionOrSub = event.data.object;
        
        // Puxa o objeto da subscription real para dados mais granulares (quando recebemos a sessão completa)
        let subscriptionId = sessionOrSub.subscription;
        if (event.type !== 'checkout.session.completed') {
            subscriptionId = sessionOrSub.id;
        }

        let subscription;
        try {
            subscription = await stripe.subscriptions.retrieve(subscriptionId);
        } catch (err) {
            console.error('Falha ao obter inscrição Stripe', err);
            return res.status(500).end();
        }

        // Recupera o ID do usuário (Firebase) que passamos no Checkout
        let firebaseUID = subscription.metadata.firebaseUID;
        if (!firebaseUID && event.type === 'checkout.session.completed') {
            firebaseUID = sessionOrSub.client_reference_id;
        }

        if (!firebaseUID) {
            console.error('Firebase UID não encontrado nos metadados da assinatura do Stripe.');
            return res.status(400).send('No firebaseUID attached');
        }

        const userRef = db.collection('users').doc(firebaseUID);
        
        try {
            // Se a assinatura for cancelada ou não-paga, status = free
            let status = subscription.status; // 'active', 'trialing', 'past_due', 'canceled', etc
            if (status === 'canceled' || status === 'unpaid') {
                status = 'free';
            }

            // Atualiza o schema no banco conforme planejado
            await userRef.set({
                stripe_customer_id: subscription.customer,
                stripe_subscription_id: subscription.id,
                subscription_status: status,
                current_period_end: admin.firestore.Timestamp.fromMillis(subscription.current_period_end * 1000),
                subscription_start: admin.firestore.Timestamp.fromMillis(subscription.start_date * 1000),
            }, { merge: true });

            console.log(`Sucesso: Usuário ${firebaseUID} atualizado para status: ${status}`);
        } catch (e) {
            console.error(`Erro ao atualizar Firebase para Firebase UID: ${firebaseUID}`, e);
            return res.status(500).send('Erro Firebase');
        }
    }

    res.status(200).json({ received: true });
}
