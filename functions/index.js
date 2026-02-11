const functions = require('firebase-functions')
const admin = require('firebase-admin')

admin.initializeApp()

const ADMIN_EMAIL = 'edu.netto.smedeiros@hotmail.com'

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  if (!context.auth || context.auth.token?.email !== ADMIN_EMAIL) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Apenas administradores podem excluir usuários.',
    )
  }

  const uid = typeof data?.uid === 'string' ? data.uid.trim() : ''
  const email = typeof data?.email === 'string' ? data.email.trim() : ''
  if (!uid && !email) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Informe o UID ou email do usuário.',
    )
  }

  const targetUser = uid
    ? await admin.auth().getUser(uid)
    : await admin.auth().getUserByEmail(email)
  await admin.auth().deleteUser(targetUser.uid)
  await admin.firestore().collection('userProfiles').doc(targetUser.uid).delete()

  return { ok: true }
})
