import { collection } from 'firebase/firestore'
import { db } from './firebase'

export const peopleCollection = (uid: string) =>
  collection(db, 'users', uid, 'people')

export const debtsCollection = (uid: string) =>
  collection(db, 'users', uid, 'debts')

export const billsCollection = (uid: string) =>
  collection(db, 'users', uid, 'bills')
