import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { getDoc, setDoc } from 'firebase/firestore'
import { auth } from '../lib/firebase'
import { userProfileDoc } from '../lib/collections'

type AuthContextValue = {
  user: User | null
  loading: boolean
  householdId: string | null
  setHouseholdId: (householdId: string | null) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [householdId, setHouseholdIdState] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (!firebaseUser) {
        setHouseholdIdState(null)
        setLoading(false)
        return
      }
      try {
        const profileRef = userProfileDoc(firebaseUser.uid)
        const profileSnap = await getDoc(profileRef)
        if (!profileSnap.exists()) {
          await setDoc(
            profileRef,
            {
              email: firebaseUser.email ?? '',
              displayName: firebaseUser.displayName ?? '',
              householdId: null,
            },
            { merge: true },
          )
          setHouseholdIdState(null)
        } else {
          setHouseholdIdState(profileSnap.data().householdId ?? null)
        }
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  const setHouseholdId = useCallback(
    async (nextHouseholdId: string | null) => {
      if (!user) return
      await setDoc(
        userProfileDoc(user.uid),
        { householdId: nextHouseholdId },
        { merge: true },
      )
      setHouseholdIdState(nextHouseholdId)
    },
    [user],
  )

  const value = useMemo(
    () => ({ user, loading, householdId, setHouseholdId }),
    [user, loading, householdId, setHouseholdId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
