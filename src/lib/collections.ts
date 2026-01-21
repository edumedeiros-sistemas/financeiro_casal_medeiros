import { collection, doc } from 'firebase/firestore'
import { db } from './firebase'

export const householdsCollection = () => collection(db, 'households')

export const householdDoc = (householdId: string) =>
  doc(db, 'households', householdId)

export const userProfileDoc = (uid: string) =>
  doc(db, 'userProfiles', uid)

export const peopleCollection = (householdId: string) =>
  collection(db, 'households', householdId, 'people')

export const debtsCollection = (householdId: string) =>
  collection(db, 'households', householdId, 'debts')

export const billsCollection = (householdId: string) =>
  collection(db, 'households', householdId, 'bills')
