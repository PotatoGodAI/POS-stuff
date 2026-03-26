import React, { useEffect, useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Package, 
  LayoutDashboard, 
  Users, 
  LogOut, 
  Coffee, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight, 
  Search, 
  Filter, 
  Clock, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Settings, 
  User as UserIcon, 
  Key, 
  X, 
  Save, 
  Edit, 
  ArrowRight, 
  History, 
  Menu, 
  ChevronLeft, 
  Printer, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Tag, 
  Percent, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Layers, 
  ClipboardList, 
  Activity, 
  ShieldCheck, 
  UserCircle,
  Sparkles,
  Upload,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  getDocs, 
  getDoc, 
  setDoc,
  deleteDoc,
  increment,
  limit,
  writeBatch 
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { db, auth, googleProvider } from './firebase';
import { User, Ingredient, Product, Sale, Shift, SaleItem, Role, PendingOrder, UserStatus, Category } from './types';
import { format, startOfDay, endOfDay, subDays, isWithinInterval } from 'date-fns';
import { scanMenuWithAI, AISuggestion } from './services/aiService';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Components ---

const GoogleLogin = ({ error: externalError }: { error?: string }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(externalError || '');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      if (!user.email) throw new Error('No email found');

      // Check if user exists in Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data() as User;
        if (userData.status === 'blocked') {
          setError('Your account has been blocked.');
          await signOut(auth);
          return;
        }
        
        // Update last login
        await updateDoc(doc(db, 'users', user.uid), {
          lastLogin: new Date().toISOString()
        });
      } else {
        // If it's the super admin, auto-create
        if (user.email === 'jonathaniansoberano@gmail.com') {
          const superAdminData: Omit<User, 'id'> = {
            name: user.displayName || 'Super Admin',
            email: user.email,
            role: 'admin',
            status: 'active',
            isSuperAdmin: true,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', user.uid), superAdminData);
        } else {
          // Check if whitelisted (status pending)
          const q = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase()), where('status', '==', 'pending'), limit(1));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const existingDoc = querySnapshot.docs[0];
            const existingData = existingDoc.data() as User;
            
            // Link the Google UID to the whitelisted email
            const updatedData: Omit<User, 'id'> = {
              name: existingData.name,
              email: existingData.email,
              role: existingData.role,
              status: 'pending', // Keep as pending until super admin approves
              createdAt: existingData.createdAt,
              lastLogin: new Date().toISOString()
            };
            
            // Delete the placeholder doc and create new one with UID
            await deleteDoc(doc(db, 'users', existingDoc.id));
            await setDoc(doc(db, 'users', user.uid), updatedData);
          } else {
            setError('Your email is not whitelisted. Please contact the administrator.');
            await signOut(auth);
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-stone-100 font-sans p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-stone-200 text-center"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-stone-900 rounded-3xl flex items-center justify-center mb-6 shadow-xl rotate-3 hover:rotate-0 transition-transform duration-300">
            <Coffee className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-stone-900 tracking-tight mb-2">BaristaPro POS</h1>
          <p className="text-stone-500 font-medium">Professional Coffee Management</p>
        </div>

        <div className="space-y-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-4 bg-white border-2 border-stone-200 py-4 px-6 rounded-2xl font-bold text-stone-700 hover:border-stone-900 hover:bg-stone-50 transition-all duration-300 disabled:opacity-50 group"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </>
            )}
          </button>

          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 text-red-500 bg-red-50 p-4 rounded-xl text-sm font-bold border border-red-100"
            >
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              {error}
            </motion.div>
          )}
        </div>

        <div className="mt-10 pt-8 border-t border-stone-100">
          <p className="text-stone-400 text-xs font-bold uppercase tracking-widest">Enterprise Edition v2.0</p>
        </div>
      </motion.div>
    </div>
  );
};

const Sidebar = ({ activeTab, setActiveTab, user, onLogout, isCollapsed, setIsCollapsed }: { 
  activeTab: string, 
  setActiveTab: (tab: string) => void, 
  user: User,
  onLogout: () => void,
  isCollapsed: boolean,
  setIsCollapsed: (collapsed: boolean) => void
}) => {
  const tabs = [
    { id: 'pos', label: 'POS', icon: ShoppingBag, roles: ['admin', 'cashier'] },
    { id: 'orders', label: 'Orders', icon: ClipboardList, roles: ['admin', 'cashier'] },
    { id: 'products', label: 'Products', icon: Coffee, roles: ['admin'] },
    { id: 'inventory', label: 'Inventory', icon: Package, roles: ['admin'] },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin'] },
    { id: 'staff', label: 'Staff', icon: Users, roles: ['admin'] },
    { id: 'users', label: 'Users', icon: ShieldCheck, roles: ['superadmin'] },
  ];

  const filteredTabs = tabs.filter(tab => {
    if (tab.roles.includes('superadmin')) return user.isSuperAdmin;
    return tab.roles.includes(user.role);
  });

  return (
    <motion.div 
      initial={false}
      animate={{ width: isCollapsed ? 80 : 256 }}
      className="bg-stone-900 h-screen flex flex-col border-r border-stone-800 relative"
    >
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 bg-stone-900 border border-stone-800 text-white p-1 rounded-full z-10 hover:bg-stone-800 transition-colors"
      >
        {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
      </button>

      <a 
        href={window.location.href} 
        target="_blank" 
        rel="noopener noreferrer" 
        className={`p-6 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} hover:opacity-80 transition-opacity cursor-pointer group`}
      >
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
          <Coffee className="text-stone-900 w-6 h-6" />
        </div>
        {!isCollapsed && <span className="font-bold text-white text-lg tracking-tight truncate">BaristaPro</span>}
      </a>

      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto scrollbar-hide">
        {filteredTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl transition-all duration-200 group ${
              activeTab === tab.id 
                ? 'bg-white text-stone-900 shadow-lg' 
                : 'text-stone-400 hover:bg-stone-800 hover:text-white'
            }`}
            title={isCollapsed ? tab.label : ''}
          >
            <tab.icon className={`w-6 h-6 flex-shrink-0 ${activeTab === tab.id ? 'text-stone-900' : 'group-hover:scale-110 transition-transform'}`} />
            {!isCollapsed && <span className="font-semibold truncate">{tab.label}</span>}
          </button>
        ))}
      </nav>

      <div className="p-4 mt-auto">
        {!isCollapsed && (
          <div className="bg-stone-800 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-stone-700 rounded-full flex items-center justify-center flex-shrink-0">
                <UserIcon className="text-stone-300 w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-bold truncate">{user.name}</p>
                <p className="text-stone-500 text-xs capitalize truncate">{user.role}</p>
              </div>
            </div>
          </div>
        )}
        <button 
          onClick={onLogout}
          className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-4 px-4'} py-4 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all group`}
          title={isCollapsed ? 'Logout' : ''}
        >
          <LogOut className="w-6 h-6 flex-shrink-0 group-hover:translate-x-1 transition-transform" />
          {!isCollapsed && <span className="font-semibold">Logout</span>}
        </button>
      </div>
    </motion.div>
  );
};

const UserManagement = ({ superAdmin }: { superAdmin: User }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    });
    return () => unsub();
  }, []);

  const handleWhitelist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'users'), {
        name: newName,
        email: newEmail.toLowerCase(),
        role: 'admin',
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      setNewEmail('');
      setNewName('');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, status: UserStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), { status });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto font-sans">
      <div className="mb-12">
        <h1 className="text-4xl font-black text-stone-900 mb-2">User Management</h1>
        <p className="text-stone-500 font-medium">Whitelist and approve new administrators</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-1">
          <div className="bg-white p-8 rounded-[2rem] border border-stone-200 shadow-sm sticky top-8">
            <h2 className="text-xl font-bold text-stone-900 mb-6">Whitelist New Admin</h2>
            <form onSubmit={handleWhitelist} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-2">Full Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 focus:border-stone-900 transition-all outline-none font-medium"
                  placeholder="e.g. John Doe"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-black text-stone-400 uppercase tracking-widest mb-2">Gmail Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-stone-50 border-2 border-stone-100 rounded-2xl px-4 py-3 focus:border-stone-900 transition-all outline-none font-medium"
                  placeholder="e.g. john@gmail.com"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold hover:bg-stone-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Whitelist Admin
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="space-y-4">
            {users.filter(u => !u.isSuperAdmin).map(u => (
              <div key={u.id} className="bg-white p-6 rounded-3xl border border-stone-200 flex items-center justify-between group hover:border-stone-400 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
                    <UserCircle className="text-stone-400 w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-stone-900">{u.name}</p>
                    <p className="text-stone-500 text-sm">{u.email}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right mr-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      u.status === 'active' ? 'bg-green-100 text-green-700' :
                      u.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {u.status}
                    </span>
                    {u.lastLogin && (
                      <p className="text-[10px] text-stone-400 mt-1">Last login: {format(new Date(u.lastLogin), 'MMM d, h:mm a')}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {u.status === 'pending' && (
                      <button
                        onClick={() => handleStatusChange(u.id, 'active')}
                        className="p-2 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-all"
                        title="Approve"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    {u.status === 'active' && (
                      <button
                        onClick={() => handleStatusChange(u.id, 'blocked')}
                        className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all"
                        title="Block"
                      >
                        <AlertCircle className="w-5 h-5" />
                      </button>
                    )}
                    {u.status === 'blocked' && (
                      <button
                        onClick={() => handleStatusChange(u.id, 'active')}
                        className="p-2 bg-stone-100 text-stone-600 rounded-xl hover:bg-stone-200 transition-all"
                        title="Unblock"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(u.id)}
                      className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {users.filter(u => !u.isSuperAdmin).length === 0 && (
              <div className="text-center py-20 bg-stone-50 rounded-[3rem] border-2 border-dashed border-stone-200">
                <Users className="w-12 h-12 text-stone-300 mx-auto mb-4" />
                <p className="text-stone-500 font-medium">No administrators whitelisted yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [loginError, setLoginError] = useState<string | undefined>();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const seedData = async () => {
    if (!auth.currentUser) return;
    
    try {
      // Check if any users exist at all
      const usersSnap = await getDocs(collection(db, 'users'));
      
      if (usersSnap.empty) {
        console.log('Database is empty, seeding initial data...');
        
        // Add Admin using the current auth UID so isAdmin() rules work immediately
        const adminData = {
          name: 'Admin User',
          pin: '123456',
          role: 'admin',
          createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'users', auth.currentUser.uid), adminData);

        const ownerId = auth.currentUser.uid;

        // Add Categories
        const coffeeCat = await addDoc(collection(db, 'categories'), {
          name: 'Coffee',
          ownerId,
          createdAt: new Date().toISOString()
        });

        const nonCoffeeCat = await addDoc(collection(db, 'categories'), {
          name: 'Non-coffee',
          ownerId,
          createdAt: new Date().toISOString()
        });

        const pastriesCat = await addDoc(collection(db, 'categories'), {
          name: 'Pastries',
          ownerId,
          createdAt: new Date().toISOString()
        });

        // Add Ingredients
        const beansRef = await addDoc(collection(db, 'ingredients'), {
          name: 'Coffee Beans',
          stockLevel: 5000,
          unitName: 'g',
          unitAmount: 1,
          pricePerUnitAmount: 0.5,
          lowStockThreshold: 1000,
          ownerId
        });

        const milkRef = await addDoc(collection(db, 'ingredients'), {
          name: 'Fresh Milk',
          stockLevel: 10000,
          unitName: 'ml',
          unitAmount: 1,
          pricePerUnitAmount: 0.1,
          lowStockThreshold: 2000,
          ownerId
        });

        // Add Products
        await addDoc(collection(db, 'products'), {
          name: 'Classic Latte',
          category: 'Coffee',
          basePrice: 120,
          variations: { 'Small': 0, 'Medium': 20, 'Large': 40 },
          addOns: { 'Extra Shot': 15, 'Oat Milk': 20 },
          recipe: [
            { ingredientId: beansRef.id, quantity: 18 },
            { ingredientId: milkRef.id, quantity: 200 }
          ],
          ownerId
        });

        await addDoc(collection(db, 'products'), {
          name: 'Butter Croissant',
          category: 'Pastries',
          basePrice: 85,
          variations: {},
          addOns: {},
          recipe: [],
          ownerId
        });

        // alert('System initialized! Use PIN 123456 to login.');
      }
    } catch (err) {
      console.error('Seeding failed:', err);
      // We can handle specific firestore errors here if needed
      if (err instanceof Error && err.message.includes('permission')) {
        handleFirestoreError(err, OperationType.WRITE, 'seedData');
      }
    }
  };

  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocs(query(collection(db, 'test'), limit(1)));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. The client is offline.");
        }
      }
    };
    if (authReady) {
      testConnection();
      seedData();
    }
  }, [authReady]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            if (userData.status === 'active' || userData.isSuperAdmin) {
              setUser({ id: userDoc.id, ...userData });
            } else if (userData.status === 'pending') {
              setUser({ id: userDoc.id, ...userData });
            } else {
              setLoginError('Your account has been blocked.');
              await signOut(auth);
            }
          } else {
            // Check if it's the super admin
            if (firebaseUser.email === 'jonathaniansoberano@gmail.com') {
              const superAdminData: Omit<User, 'id'> = {
                name: firebaseUser.displayName || 'Super Admin',
                email: firebaseUser.email,
                role: 'admin',
                status: 'active',
                isSuperAdmin: true,
                createdAt: new Date().toISOString(),
                lastLogin: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), superAdminData);
              setUser({ id: firebaseUser.uid, ...superAdminData });
            } else {
              // Not whitelisted
              await signOut(auth);
            }
          }
        } catch (err) {
          console.error('Auth sync failed:', err);
        }
      } else {
        setUser(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || user.status === 'pending') return;

    const ownerId = user.isSuperAdmin ? null : (user.role === 'admin' ? user.id : user.ownerId);
    
    const productsQuery = ownerId ? query(collection(db, 'products'), where('ownerId', '==', ownerId)) : collection(db, 'products');
    const unsubProducts = onSnapshot(productsQuery, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products');
    });

    const categoriesQuery = ownerId ? query(collection(db, 'categories'), where('ownerId', '==', ownerId)) : collection(db, 'categories');
    const unsubCategories = onSnapshot(categoriesQuery, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'categories');
    });

    const ingredientsQuery = ownerId ? query(collection(db, 'ingredients'), where('ownerId', '==', ownerId)) : collection(db, 'ingredients');
    const unsubIngredients = onSnapshot(ingredientsQuery, (snapshot) => {
      setIngredients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'ingredients');
    });

    const salesQuery = ownerId 
      ? query(collection(db, 'sales'), where('ownerId', '==', ownerId), orderBy('timestamp', 'desc'))
      : query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
    const unsubSales = onSnapshot(salesQuery, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sales');
    });

    const pendingQuery = ownerId
      ? query(collection(db, 'pendingOrders'), where('ownerId', '==', ownerId), orderBy('timestamp', 'desc'))
      : query(collection(db, 'pendingOrders'), orderBy('timestamp', 'desc'));
    const unsubPending = onSnapshot(pendingQuery, (snapshot) => {
      setPendingOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PendingOrder)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'pendingOrders');
    });

    setLoading(false);

    return () => {
      unsubProducts();
      unsubCategories();
      unsubIngredients();
      unsubSales();
      unsubPending();
    };
  }, [user]);

  const deletePendingOrder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'pendingOrders', id));
    } catch (err) {
      console.error(err);
    }
  };

  const deleteSale = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'sales', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sales/${id}`);
    }
  };

  const updatePendingItem = async (orderId: string, itemIndex: number, delta: number) => {
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    newItems[itemIndex].quantity = Math.max(1, newItems[itemIndex].quantity + delta);
    
    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) - order.discount;

    try {
      await updateDoc(doc(db, 'pendingOrders', orderId), {
        items: newItems,
        total: newTotal
      });
    } catch (err) {
      console.error(err);
    }
  };

  const removePendingItem = async (orderId: string, itemIndex: number) => {
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...order.items];
    newItems.splice(itemIndex, 1);
    
    if (newItems.length === 0) {
      await deletePendingOrder(orderId);
      return;
    }

    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) - order.discount;

    try {
      await updateDoc(doc(db, 'pendingOrders', orderId), {
        items: newItems,
        total: newTotal
      });
    } catch (err) {
      console.error(err);
    }
  };

  const addProductToPending = async (orderId: string, product: Product, variation: string, addOns: string[]) => {
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return;

    const variationPrice = variation ? product.variations[variation] : 0;
    let addOnsPrice = 0;
    addOns.forEach(name => {
      addOnsPrice += product.addOns[name] || 0;
    });
    
    let cost = 0;
    product.recipe.forEach(item => {
      const ingredient = ingredients.find(i => i.id === item.ingredientId);
      if (ingredient && ingredient.unitAmount > 0) {
        cost += (ingredient.pricePerUnitAmount / ingredient.unitAmount) * item.quantity;
      }
    });

    const newItem: SaleItem = {
      productId: product.id,
      productName: product.name,
      variation: variation || '',
      addOns: addOns,
      price: product.basePrice + variationPrice + addOnsPrice,
      cost: cost || 0,
      quantity: 1
    };

    const newItems = [...order.items, newItem];
    const newTotal = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0) - order.discount;

    try {
      await updateDoc(doc(db, 'pendingOrders', orderId), {
        items: newItems,
        total: newTotal
      });
    } catch (err) {
      console.error(err);
    }
  };

  const completePendingOrder = async (order: PendingOrder) => {
    try {
      const batch = writeBatch(db);
      const totalCost = order.items.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
      
      // Deduct inventory
      for (const item of order.items) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          for (const recipeItem of product.recipe) {
            const ingredientRef = doc(db, 'ingredients', recipeItem.ingredientId);
            const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
            if (ingredient) {
              batch.update(ingredientRef, {
                stockLevel: increment(-(recipeItem.quantity * item.quantity))
              });
            }
          }
        }
      }

      // Create sale
      const saleData = {
        items: order.items,
        total: order.total,
        discount: order.discount,
        paymentMethod: 'Cash',
        staffId: order.staffId,
        staffName: order.staffName,
        ownerId: order.ownerId,
        timestamp: new Date().toISOString(),
        totalCost: totalCost || 0,
        profit: (order.total || 0) - (totalCost || 0)
      };
      
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, saleData);
      
      // Delete pending
      batch.delete(doc(db, 'pendingOrders', order.id));
      
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout failed:', err);
    }
    setUser(null);
    setActiveTab('pos');
  };

  if (!authReady) return <div className="flex items-center justify-center h-screen bg-stone-100"><Activity className="animate-spin text-stone-900" /></div>;

  if (!user) {
    return <GoogleLogin error={loginError} />;
  }

  if (user.status === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-stone-100 p-8 text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mb-6">
          <Clock className="text-amber-600 w-10 h-10 animate-pulse" />
        </div>
        <h1 className="text-3xl font-black text-stone-900 mb-2">Waiting for Approval</h1>
        <p className="text-stone-500 max-w-md font-medium">
          Your account has been created successfully. Please wait for the Super Admin to approve your access.
        </p>
        <button 
          onClick={() => signOut(auth)}
          className="mt-8 text-stone-400 font-bold hover:text-stone-900 transition-colors"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        onLogout={handleLogout} 
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />
      
      <main className="flex-1 overflow-y-auto relative">
        <AnimatePresence mode="wait">
          {activeTab === 'pos' && (
            <motion.div key="pos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <POSView 
                user={user} 
                products={products} 
                categories={categories}
                ingredients={ingredients} 
                pendingOrders={pendingOrders}
                onDeletePending={deletePendingOrder}
                onUpdatePendingItem={updatePendingItem}
                onRemovePendingItem={removePendingItem}
                onAddProductToPending={addProductToPending}
                onCompletePending={completePendingOrder}
              />
            </motion.div>
          )}
          {activeTab === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <OrdersView 
                sales={sales} 
                pendingOrders={pendingOrders} 
                products={products} 
                categories={categories}
                ingredients={ingredients}
                onDeletePending={deletePendingOrder}
                onUpdatePendingItem={updatePendingItem}
                onRemovePendingItem={removePendingItem}
                onAddProductToPending={addProductToPending}
                onCompletePending={completePendingOrder}
                onDeleteSale={deleteSale}
                isAdmin={user?.role === 'admin'}
              />
            </motion.div>
          )}
          {activeTab === 'products' && (
            <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <ProductsView products={products} categories={categories} ingredients={ingredients} sales={sales} currentUser={user} />
            </motion.div>
          )}
          {activeTab === 'inventory' && (
            <motion.div key="inventory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <InventoryView ingredients={ingredients} products={products} currentUser={user} />
            </motion.div>
          )}
          {activeTab === 'dashboard' && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <DashboardView sales={sales} products={products} ingredients={ingredients} />
            </motion.div>
          )}
          {activeTab === 'staff' && (
            <motion.div key="staff" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <StaffView currentUser={user} />
            </motion.div>
          )}
          {activeTab === 'users' && user.isSuperAdmin && (
            <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <UserManagement superAdmin={user} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- Views ---

const POSView = ({ 
  user, 
  products, 
  categories: dynamicCategories,
  ingredients, 
  pendingOrders,
  onDeletePending,
  onUpdatePendingItem,
  onRemovePendingItem,
  onAddProductToPending,
  onCompletePending
}: { 
  user: User, 
  products: Product[], 
  categories: Category[],
  ingredients: Ingredient[],
  pendingOrders: PendingOrder[],
  onDeletePending: (id: string) => Promise<void>,
  onUpdatePendingItem: (orderId: string, itemIndex: number, delta: number) => Promise<void>,
  onRemovePendingItem: (orderId: string, itemIndex: number) => Promise<void>,
  onAddProductToPending: (orderId: string, product: Product, variation: string, addOns: string[]) => Promise<void>,
  onCompletePending: (order: PendingOrder) => Promise<void>
}) => {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'GCash' | 'Card'>('Cash');
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [posMode, setPosMode] = useState<'menu' | 'pending'>('menu');
  const [selectedPending, setSelectedPending] = useState<PendingOrder | null>(null);
  const [isAddingProductToPending, setIsAddingProductToPending] = useState(false);
  const [searchProductForPending, setSearchProductForPending] = useState('');
  const [selectedProductForVariations, setSelectedProductForVariations] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string>('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);
  const [targetOrderId, setTargetOrderId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const names = dynamicCategories.map(c => c.name);
    return ['All', ...Array.from(new Set(names))];
  }, [dynamicCategories]);

  const filteredProducts = products.filter(p => 
    (category === 'All' || p.category === category) &&
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProductsForPending = products.filter(p => 
    p.name.toLowerCase().includes(searchProductForPending.toLowerCase())
  );

  const openVariationModal = (product: Product, orderId: string | null = null) => {
    setSelectedProductForVariations(product);
    const firstVariation = Object.keys(product.variations)[0] || '';
    setSelectedVariation(firstVariation);
    setSelectedAddOns([]);
    setTargetOrderId(orderId);
  };

  const handleAddToOrder = async (product: Product, variation: string, addOns: string[]) => {
    if (targetOrderId) {
      await onAddProductToPending(targetOrderId, product, variation, addOns);
      setTargetOrderId(null);
      setSelectedProductForVariations(null);
    } else {
      addToCart(product, variation, addOns);
    }
  };

  const addToCart = (product: Product, variation: string, addOns: string[]) => {
    const variationPrice = variation ? product.variations[variation] : 0;
    let addOnsPrice = 0;
    addOns.forEach(name => {
      addOnsPrice += product.addOns[name] || 0;
    });
    
    // Calculate cost based on recipe
    let cost = 0;
    product.recipe.forEach(item => {
      const ingredient = ingredients.find(i => i.id === item.ingredientId);
      if (ingredient && ingredient.unitAmount > 0) {
        cost += (ingredient.pricePerUnitAmount / ingredient.unitAmount) * item.quantity;
      }
    });

    const newItem: SaleItem = {
      productId: product.id,
      productName: product.name,
      variation: variation || '',
      addOns: addOns,
      price: product.basePrice + variationPrice + addOnsPrice,
      cost: cost || 0,
      quantity: 1
    };

    setCart([...cart, newItem]);
    setSelectedProductForVariations(null);
  };

  const updateCartItem = (index: number, updates: Partial<SaleItem>) => {
    const newCart = [...cart];
    newCart[index] = { ...newCart[index], ...updates };
    
    // Recalculate price if variation or add-ons change
    const product = products.find(p => p.id === newCart[index].productId);
    if (product) {
      const variationPrice = newCart[index].variation ? product.variations[newCart[index].variation!] : 0;
      let addOnsPrice = 0;
      newCart[index].addOns.forEach(name => {
        addOnsPrice += product.addOns[name] || 0;
      });
      newCart[index].price = product.basePrice + variationPrice + addOnsPrice;
    }
    
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal - discount;

  const handleCreateOrder = async () => {
    if (cart.length === 0) return;
    setIsCreatingOrder(true);
    try {
      const sanitizedItems = cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        variation: item.variation || '',
        addOns: item.addOns || [],
        price: item.price || 0,
        cost: item.cost || 0,
        quantity: item.quantity || 1
      }));

      const orderData = {
        items: sanitizedItems,
        total: total || 0,
        discount: discount || 0,
        staffId: user.id || '',
        staffName: user.name || '',
        ownerId: user.isSuperAdmin ? null : (user.role === 'admin' ? user.id : user.ownerId),
        timestamp: new Date().toISOString()
      };
      
      await addDoc(collection(db, 'pendingOrders'), orderData);
      setCart([]);
      setDiscount(0);
      // alert('Order created successfully!');
    } catch (err) {
      console.error(err);
      // alert('Failed to create order');
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsCheckingOut(true);

    try {
      const batch = writeBatch(db);
      const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
      
      // 1. Create Sale Record
      // Ensure no undefined values are passed to Firestore
      const sanitizedItems = cart.map(item => ({
        productId: item.productId,
        productName: item.productName,
        variation: item.variation || '',
        addOns: item.addOns || [],
        price: item.price || 0,
        cost: item.cost || 0,
        quantity: item.quantity || 1
      }));

      const saleData = {
        items: sanitizedItems,
        total: total || 0,
        discount: discount || 0,
        paymentMethod: paymentMethod || 'Cash',
        staffId: user.id || '',
        staffName: user.name || '',
        ownerId: user.isSuperAdmin ? null : (user.role === 'admin' ? user.id : user.ownerId),
        timestamp: new Date().toISOString(),
        totalCost: totalCost || 0,
        profit: (total || 0) - (totalCost || 0)
      };
      
      const saleRef = doc(collection(db, 'sales'));
      batch.set(saleRef, saleData);

      // 2. Deduct Inventory
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          for (const recipeItem of product.recipe) {
            const ingredient = ingredients.find(i => i.id === recipeItem.ingredientId);
            if (ingredient) {
              const ingredientRef = doc(db, 'ingredients', ingredient.id);
              batch.update(ingredientRef, {
                stockLevel: ingredient.stockLevel - (recipeItem.quantity * item.quantity)
              });
            }
          }
        }
      }

      await batch.commit();
      setCart([]);
      setDiscount(0);
      // alert('Sale completed successfully!');
    } catch (err) {
      console.error(err);
      // alert('Checkout failed');
    } finally {
      setIsCheckingOut(false);
    }
  };

  return (
    <div className="flex h-full">
      {/* Product Selection / Pending Orders */}
      <div className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-black text-stone-900">POS</h2>
            <div className="bg-stone-200 p-1 rounded-xl flex gap-1">
              <button 
                onClick={() => setPosMode('menu')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  posMode === 'menu' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Menu
              </button>
              <button 
                onClick={() => setPosMode('pending')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  posMode === 'pending' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Pending Orders
              </button>
            </div>
          </div>
          {posMode === 'menu' && (
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Search products..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
              />
            </div>
          )}
        </div>

        {posMode === 'menu' ? (
          <>
            <div className="flex flex-col gap-2 flex-shrink-0">
              <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest ml-1">Categories</p>
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setCategory(cat)}
                    className={`px-8 py-3.5 rounded-2xl font-bold whitespace-nowrap transition-all shadow-sm border ${
                      category === cat 
                        ? 'bg-stone-900 text-white border-stone-900 shadow-lg -translate-y-0.5' 
                        : 'bg-white text-stone-600 hover:bg-stone-50 border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pr-2 content-start">
              {filteredProducts.map(product => (
                <motion.button
                  key={product.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => openVariationModal(product)}
                  className="bg-white p-4 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all flex flex-col items-start text-left group"
                >
                  <div className="w-full aspect-square bg-stone-100 rounded-2xl mb-3 flex items-center justify-center group-hover:bg-stone-200 transition-colors">
                    <Coffee className="text-stone-400 w-8 h-8" />
                  </div>
                  <p className="font-bold text-stone-900 text-sm leading-tight line-clamp-2 mb-1">{product.name}</p>
                  <p className="mt-auto font-black text-stone-900">₱{product.basePrice}</p>
                </motion.button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {pendingOrders.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 opacity-50">
                <Clock className="w-16 h-16 mb-4" />
                <p className="text-xl font-bold">No pending orders</p>
              </div>
            ) : (
              pendingOrders.map(order => (
                <div
                  key={order.id}
                  className={`w-full bg-white p-6 rounded-3xl border transition-all ${
                    selectedPending?.id === order.id ? 'border-stone-900 shadow-lg' : 'border-stone-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
                        <Clock className="text-stone-400 w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-stone-900">Pending #{order.id.slice(-6).toUpperCase()}</p>
                        <p className="text-stone-500 text-sm">{format(new Date(order.timestamp), 'h:mm a')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-black text-stone-900 text-lg mr-2">₱{order.total}</p>
                      <button 
                        onClick={() => onCompletePending(order)}
                        className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-all font-bold text-xs shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Complete Sale
                      </button>
                      <button 
                        onClick={() => setSelectedPending(selectedPending?.id === order.id ? null : order)}
                        className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                      >
                        {selectedPending?.id === order.id ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                      </button>
                      <button 
                        onClick={() => onDeletePending(order.id)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {selectedPending?.id === order.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="border-t border-stone-100 pt-4 mt-4 space-y-3">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-stone-50 p-3 rounded-2xl">
                              <div className="flex-1">
                                <p className="font-bold text-stone-900 text-sm">{item.productName}</p>
                                <p className="text-stone-400 text-[10px] uppercase font-bold">{item.variation}</p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-white rounded-lg border border-stone-200 p-1">
                                  <button 
                                    onClick={() => onUpdatePendingItem(order.id, idx, -1)}
                                    className="w-6 h-6 flex items-center justify-center hover:bg-stone-100 rounded transition-colors"
                                  >
                                    <Minus className="w-3 h-3" />
                                  </button>
                                  <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                                  <button 
                                    onClick={() => onUpdatePendingItem(order.id, idx, 1)}
                                    className="w-6 h-6 flex items-center justify-center hover:bg-stone-100 rounded transition-colors"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                                <p className="font-bold text-stone-900 text-sm w-16 text-right">₱{item.price * item.quantity}</p>
                                <button 
                                  onClick={() => onRemovePendingItem(order.id, idx)}
                                  className="text-stone-300 hover:text-red-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}

                          <div className="flex gap-2 pt-2">
                            <button 
                              onClick={() => setIsAddingProductToPending(true)}
                              className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 hover:border-stone-900 hover:text-stone-900 transition-all font-bold text-sm"
                            >
                              <Plus className="w-4 h-4" />
                              Add Product
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))
            )}
          </div>
        )}

        {/* Add Product to Pending Modal */}
        <AnimatePresence>
          {isAddingProductToPending && selectedPending && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
              >
                <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                  <h3 className="text-xl font-bold text-stone-900">Add Product</h3>
                  <button onClick={() => setIsAddingProductToPending(false)} className="p-2 hover:bg-stone-100 rounded-xl">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-6">
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                    <input 
                      type="text" 
                      placeholder="Search products..." 
                      value={searchProductForPending}
                      onChange={(e) => setSearchProductForPending(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    />
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                    {filteredProductsForPending.map(product => (
                      <button
                        key={product.id}
                        onClick={() => {
                          setIsAddingProductToPending(false);
                          openVariationModal(product, selectedPending.id);
                          setSearchProductForPending('');
                        }}
                        className="w-full flex items-center justify-between p-3 hover:bg-stone-50 rounded-2xl transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center group-hover:bg-stone-200 transition-colors">
                            <Coffee className="text-stone-400 w-5 h-5" />
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-stone-900 text-sm leading-tight line-clamp-2">{product.name}</p>
                          </div>
                        </div>
                        <p className="font-black text-stone-900 text-sm">₱{product.basePrice}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Variation Selection Modal */}
        <AnimatePresence>
          {selectedProductForVariations && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
              >
                <div className="p-8 border-b border-stone-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-2xl font-black text-stone-900">{selectedProductForVariations.name}</h3>
                    <p className="text-stone-500 font-medium">Customize your order</p>
                  </div>
                  <button onClick={() => setSelectedProductForVariations(null)} className="p-3 hover:bg-stone-100 rounded-2xl transition-colors">
                    <X className="w-6 h-6 text-stone-400" />
                  </button>
                </div>
                
                <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide">
                  {/* Variations */}
                  {Object.keys(selectedProductForVariations.variations).length > 0 && (
                    <div className="space-y-4">
                      <p className="text-xs font-black text-stone-400 uppercase tracking-widest">Select Size / Variation</p>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(selectedProductForVariations.variations).map(([name, price]) => (
                          <button
                            key={name}
                            onClick={() => setSelectedVariation(name)}
                            className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 ${
                              selectedVariation === name 
                                ? 'border-stone-900 bg-stone-900 text-white shadow-lg' 
                                : 'border-stone-100 bg-stone-50 text-stone-600 hover:border-stone-200'
                            }`}
                          >
                            <span className="font-bold">{name}</span>
                            <span className={`text-sm ${selectedVariation === name ? 'text-stone-300' : 'text-stone-400'}`}>
                              +₱{price}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add-ons */}
                  {Object.keys(selectedProductForVariations.addOns).length > 0 && (
                    <div className="space-y-4">
                      <p className="text-xs font-black text-stone-400 uppercase tracking-widest">Add-ons</p>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(selectedProductForVariations.addOns).map(([name, price]) => (
                          <button
                            key={name}
                            onClick={() => {
                              if (selectedAddOns.includes(name)) {
                                setSelectedAddOns(selectedAddOns.filter(a => a !== name));
                              } else {
                                setSelectedAddOns([...selectedAddOns, name]);
                              }
                            }}
                            className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 ${
                              selectedAddOns.includes(name)
                                ? 'border-stone-900 bg-stone-900 text-white shadow-lg' 
                                : 'border-stone-100 bg-stone-50 text-stone-600 hover:border-stone-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{name}</span>
                              {selectedAddOns.includes(name) && <CheckCircle className="w-4 h-4" />}
                            </div>
                            <span className={`text-sm ${selectedAddOns.includes(name) ? 'text-stone-300' : 'text-stone-400'}`}>
                              +₱{price}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                  <div>
                    <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Total Price</p>
                    <p className="text-3xl font-black text-stone-900">
                      ₱{selectedProductForVariations.basePrice + 
                        (selectedVariation ? selectedProductForVariations.variations[selectedVariation] : 0) +
                        selectedAddOns.reduce((sum, name) => sum + (selectedProductForVariations?.addOns[name] || 0), 0)
                      }
                    </p>
                  </div>
                  <button
                    onClick={() => handleAddToOrder(selectedProductForVariations, selectedVariation, selectedAddOns)}
                    className="px-10 py-4 bg-stone-900 text-white rounded-2xl font-black hover:bg-stone-800 transition-all shadow-xl hover:shadow-2xl active:scale-95 flex items-center gap-3"
                  >
                    <Plus className="w-5 h-5" />
                    Add to Order
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart / Checkout */}
      <div className="w-96 bg-white border-l border-stone-200 flex flex-col shadow-2xl">
        <div className="p-6 border-bottom border-stone-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-stone-900">Current Order</h2>
          <button onClick={() => setCart([])} className="text-stone-400 hover:text-red-500 transition-colors">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 opacity-50">
              <ShoppingBag className="w-12 h-12 mb-4" />
              <p className="font-medium">Cart is empty</p>
            </div>
          ) : (
            cart.map((item, index) => (
              <div key={index} className="bg-stone-50 p-4 rounded-2xl border border-stone-100">
                <div className="flex justify-between mb-2">
                  <p className="font-bold text-stone-900">{item.productName}</p>
                  <p className="font-bold text-stone-900">₱{item.price * item.quantity}</p>
                </div>
                
                <div className="flex flex-wrap gap-1 mb-3">
                  {item.variation && (
                    <span className="text-[10px] uppercase tracking-wider font-bold bg-stone-200 text-stone-600 px-2 py-0.5 rounded-full">
                      {item.variation}
                    </span>
                  )}
                  {item.addOns.map(addon => (
                    <span key={addon} className="text-[10px] uppercase tracking-wider font-bold bg-stone-900 text-white px-2 py-0.5 rounded-full">
                      {addon}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 bg-white rounded-xl border border-stone-200 p-1">
                    <button 
                      onClick={() => updateCartItem(index, { quantity: Math.max(1, item.quantity - 1) })}
                      className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded-lg transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="font-bold w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateCartItem(index, { quantity: item.quantity + 1 })}
                      className="w-8 h-8 flex items-center justify-center hover:bg-stone-100 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <button onClick={() => removeFromCart(index)} className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-stone-50 border-t border-stone-200 space-y-4">
          <div className="flex justify-between text-stone-500 font-medium">
            <span>Subtotal</span>
            <span>₱{subtotal}</span>
          </div>
          <div className="flex justify-between text-stone-500 font-medium">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4" />
              <span>Discount</span>
            </div>
            <input 
              type="number" 
              value={discount}
              onChange={(e) => setDiscount(Number(e.target.value))}
              className="w-20 text-right bg-transparent border-b border-stone-300 focus:outline-none focus:border-stone-900"
            />
          </div>
          <div className="flex justify-between text-2xl font-black text-stone-900 pt-2">
            <span>Total</span>
            <span>₱{total}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {(['Cash', 'GCash', 'Card'] as const).map(method => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={`py-3 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  paymentMethod === method 
                    ? 'bg-stone-900 text-white shadow-lg' 
                    : 'bg-white text-stone-500 border border-stone-200 hover:bg-stone-100'
                }`}
              >
                {method === 'Cash' && <Banknote className="w-5 h-5" />}
                {method === 'GCash' && <Smartphone className="w-5 h-5" />}
                {method === 'Card' && <CreditCard className="w-5 h-5" />}
                <span className="text-[10px] font-bold uppercase">{method}</span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <button
              disabled={cart.length === 0 || isCheckingOut || isCreatingOrder}
              onClick={handleCreateOrder}
              className="w-full bg-stone-100 text-stone-900 py-3 rounded-2xl font-bold text-sm shadow-md hover:bg-stone-200 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {isCreatingOrder ? <Activity className="animate-spin" /> : <Plus className="w-5 h-5" />}
              Create Order
            </button>
            <button
              disabled={cart.length === 0 || isCheckingOut || isCreatingOrder}
              onClick={handleCheckout}
              className="w-full bg-stone-900 text-white py-3 rounded-2xl font-bold text-sm shadow-xl hover:bg-stone-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {isCheckingOut ? <Activity className="animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              Complete Sale
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrdersView = ({ 
  sales, 
  pendingOrders, 
  products, 
  categories,
  ingredients,
  onDeletePending,
  onUpdatePendingItem,
  onRemovePendingItem,
  onAddProductToPending,
  onCompletePending,
  onDeleteSale,
  isAdmin
}: { 
  sales: Sale[], 
  pendingOrders: PendingOrder[], 
  products: Product[], 
  categories: Category[],
  ingredients: Ingredient[],
  onDeletePending: (id: string) => Promise<void>,
  onUpdatePendingItem: (orderId: string, itemIndex: number, delta: number) => Promise<void>,
  onRemovePendingItem: (orderId: string, itemIndex: number) => Promise<void>,
  onAddProductToPending: (orderId: string, product: Product, variation: string, addOns: string[]) => Promise<void>,
  onCompletePending: (order: PendingOrder) => Promise<void>,
  onDeleteSale: (id: string) => Promise<void>,
  isAdmin: boolean
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'history' | 'pending'>('history');
  const [selectedOrder, setSelectedOrder] = useState<Sale | null>(null);
  const [selectedPending, setSelectedPending] = useState<PendingOrder | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [searchProduct, setSearchProduct] = useState('');
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [selectedProductForVariations, setSelectedProductForVariations] = useState<Product | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<string>('');
  const [selectedAddOns, setSelectedAddOns] = useState<string[]>([]);

  const openVariationModal = (product: Product) => {
    setSelectedProductForVariations(product);
    const firstVariation = Object.keys(product.variations)[0] || '';
    setSelectedVariation(firstVariation);
    setSelectedAddOns([]);
  };

  const handleAddToPending = async (product: Product, variation: string, addOns: string[]) => {
    if (selectedPending) {
      await onAddProductToPending(selectedPending.id, product, variation, addOns);
      setSelectedProductForVariations(null);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-stone-900">Orders</h2>
          <p className="text-stone-500">Manage history and pending orders</p>
        </div>
        <div className="bg-white p-2 rounded-2xl shadow-sm border border-stone-200 flex gap-2">
          <button 
            onClick={() => setActiveSubTab('history')}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
              activeSubTab === 'history' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            Order History
          </button>
          <button 
            onClick={() => setActiveSubTab('pending')}
            className={`px-6 py-2 rounded-xl font-bold text-sm transition-all ${
              activeSubTab === 'pending' ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:bg-stone-50'
            }`}
          >
            Pending Orders
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {activeSubTab === 'history' ? (
            sales.map(sale => (
              <div key={sale.id} className="relative group">
                <div
                  onClick={() => setSelectedOrder(sale)}
                  className={`w-full text-left bg-white p-6 rounded-3xl border transition-all flex items-center justify-between cursor-pointer ${
                    selectedOrder?.id === sale.id ? 'border-stone-900 shadow-lg' : 'border-stone-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center group-hover:bg-stone-200 transition-colors">
                      <History className="text-stone-400 w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-stone-900">Order #{sale.id.slice(-6).toUpperCase()}</p>
                      <p className="text-stone-500 text-sm">{format(new Date(sale.timestamp), 'MMM d, yyyy • h:mm a')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-black text-stone-900 text-lg">₱{sale.total}</p>
                      <p className="text-stone-400 text-xs uppercase tracking-widest font-bold">{sale.paymentMethod}</p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        {confirmingDeleteId === sale.id ? (
                          <div className="flex items-center gap-2 bg-red-50 p-1 rounded-xl">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteSale(sale.id);
                                setConfirmingDeleteId(null);
                              }}
                              className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors"
                            >
                              Confirm
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmingDeleteId(null);
                              }}
                              className="px-3 py-1 bg-stone-200 text-stone-600 text-xs font-bold rounded-lg hover:bg-stone-300 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingDeleteId(sale.id);
                            }}
                            className="p-2 text-stone-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            pendingOrders.map(order => (
              <div
                key={order.id}
                className={`w-full bg-white p-6 rounded-3xl border transition-all ${
                  selectedPending?.id === order.id ? 'border-stone-900 shadow-lg' : 'border-stone-200'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
                      <Clock className="text-stone-400 w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-stone-900">Pending #{order.id.slice(-6).toUpperCase()}</p>
                      <p className="text-stone-500 text-sm">{format(new Date(order.timestamp), 'h:mm a')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-black text-stone-900 text-lg mr-2">₱{order.total}</p>
                    <button 
                      onClick={() => onCompletePending(order)}
                      className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl hover:bg-stone-800 transition-all font-bold text-xs shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Complete Sale
                    </button>
                    <button 
                      onClick={() => setSelectedPending(selectedPending?.id === order.id ? null : order)}
                      className="p-2 hover:bg-stone-100 rounded-xl transition-colors"
                    >
                      {selectedPending?.id === order.id ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => onDeletePending(order.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {selectedPending?.id === order.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-stone-100 pt-4 mt-4 space-y-3">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-stone-50 p-3 rounded-2xl">
                            <div className="flex-1">
                              <p className="font-bold text-stone-900 text-sm">{item.productName}</p>
                              <p className="text-stone-400 text-[10px] uppercase font-bold">{item.variation}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2 bg-white rounded-lg border border-stone-200 p-1">
                                <button 
                                  onClick={() => onUpdatePendingItem(order.id, idx, -1)}
                                  className="w-6 h-6 flex items-center justify-center hover:bg-stone-100 rounded transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                                <button 
                                  onClick={() => onUpdatePendingItem(order.id, idx, 1)}
                                  className="w-6 h-6 flex items-center justify-center hover:bg-stone-100 rounded transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <p className="font-bold text-stone-900 text-sm w-16 text-right">₱{item.price * item.quantity}</p>
                              <button 
                                onClick={() => onRemovePendingItem(order.id, idx)}
                                className="text-stone-300 hover:text-red-500"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}

                        <div className="flex gap-2 pt-2">
                          <button 
                            onClick={() => setIsAddingProduct(true)}
                            className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-stone-200 rounded-2xl text-stone-400 hover:border-stone-900 hover:text-stone-900 transition-all font-bold text-sm"
                          >
                            <Plus className="w-4 h-4" />
                            Add Product
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-1">
          <AnimatePresence mode="wait">
            {activeSubTab === 'history' && selectedOrder ? (
              <motion.div
                key="history-detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-white p-8 rounded-3xl border border-stone-200 shadow-xl sticky top-8"
              >
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-black text-stone-900">Order Details</h3>
                    <p className="text-stone-500 text-sm">#{selectedOrder.id}</p>
                  </div>
                  <button onClick={() => setSelectedOrder(null)} className="text-stone-400 hover:text-stone-900">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4 mb-8">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div>
                        <p className="font-bold text-stone-900">{item.productName} x{item.quantity}</p>
                        <p className="text-stone-400 text-xs">{item.variation} {item.addOns.join(', ')}</p>
                      </div>
                      <p className="font-bold text-stone-900">₱{item.price * item.quantity}</p>
                    </div>
                  ))}
                </div>

                <div className="border-t border-stone-100 pt-6 space-y-2">
                  <div className="flex justify-between text-stone-500">
                    <span>Subtotal</span>
                    <span>₱{selectedOrder.total + selectedOrder.discount}</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Discount</span>
                    <span>-₱{selectedOrder.discount}</span>
                  </div>
                  <div className="flex justify-between text-xl font-black text-stone-900 pt-2">
                    <span>Total</span>
                    <span>₱{selectedOrder.total}</span>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-stone-100">
                  <div className="flex items-center gap-3 text-stone-500 text-sm mb-4">
                    <UserCircle className="w-4 h-4" />
                    <span>Served by: <span className="font-bold text-stone-900">{selectedOrder.staffName}</span></span>
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 bg-stone-100 hover:bg-stone-200 text-stone-900 py-4 rounded-2xl font-bold transition-all">
                    <Printer className="w-5 h-5" />
                    Print Receipt
                  </button>
                </div>
              </motion.div>
            ) : activeSubTab === 'history' ? (
              <div className="bg-stone-50 border-2 border-dashed border-stone-200 rounded-3xl p-12 flex flex-col items-center justify-center text-stone-400 text-center">
                <History className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">Select an order to view details</p>
              </div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Add Product Modal for Pending Orders */}
      <AnimatePresence>
        {isAddingProduct && selectedPending && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-stone-900">Add Product</h3>
                <button onClick={() => setIsAddingProduct(false)} className="text-stone-400 hover:text-stone-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  value={searchProduct}
                  onChange={(e) => setSearchProduct(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
                {products
                  .filter(p => p.name.toLowerCase().includes(searchProduct.toLowerCase()))
                  .map(product => (
                    <button
                      key={product.id}
                      onClick={() => {
                        setIsAddingProduct(false);
                        openVariationModal(product);
                        setSearchProduct('');
                      }}
                      className="w-full flex items-center justify-between p-4 bg-stone-50 hover:bg-stone-100 rounded-2xl transition-all group"
                    >
                      <div className="text-left">
                        <p className="font-bold text-stone-900">{product.name}</p>
                        <p className="text-stone-400 text-xs uppercase font-bold">{product.category}</p>
                      </div>
                      <p className="font-black text-stone-900">₱{product.basePrice}</p>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Variation Selection Modal */}
      <AnimatePresence>
        {selectedProductForVariations && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[2.5rem] w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black text-stone-900">{selectedProductForVariations.name}</h3>
                  <p className="text-stone-500 font-medium">Customize your order</p>
                </div>
                <button onClick={() => setSelectedProductForVariations(null)} className="p-3 hover:bg-stone-100 rounded-2xl transition-colors">
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>
              
              <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto scrollbar-hide">
                {/* Variations */}
                {Object.keys(selectedProductForVariations.variations).length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs font-black text-stone-400 uppercase tracking-widest">Select Size / Variation</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(selectedProductForVariations.variations).map(([name, price]) => (
                        <button
                          key={name}
                          onClick={() => setSelectedVariation(name)}
                          className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 ${
                            selectedVariation === name 
                              ? 'border-stone-900 bg-stone-900 text-white shadow-lg' 
                              : 'border-stone-100 bg-stone-50 text-stone-600 hover:border-stone-200'
                          }`}
                        >
                          <span className="font-bold">{name}</span>
                          <span className={`text-sm ${selectedVariation === name ? 'text-stone-300' : 'text-stone-400'}`}>
                            +₱{price}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add-ons */}
                {Object.keys(selectedProductForVariations.addOns).length > 0 && (
                  <div className="space-y-4">
                    <p className="text-xs font-black text-stone-400 uppercase tracking-widest">Add-ons</p>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(selectedProductForVariations.addOns).map(([name, price]) => (
                        <button
                          key={name}
                          onClick={() => {
                            if (selectedAddOns.includes(name)) {
                              setSelectedAddOns(selectedAddOns.filter(a => a !== name));
                            } else {
                              setSelectedAddOns([...selectedAddOns, name]);
                            }
                          }}
                          className={`p-4 rounded-2xl border-2 transition-all text-left flex flex-col gap-1 ${
                            selectedAddOns.includes(name)
                              ? 'border-stone-900 bg-stone-900 text-white shadow-lg' 
                              : 'border-stone-100 bg-stone-50 text-stone-600 hover:border-stone-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{name}</span>
                            {selectedAddOns.includes(name) && <CheckCircle className="w-4 h-4" />}
                          </div>
                          <span className={`text-sm ${selectedAddOns.includes(name) ? 'text-stone-300' : 'text-stone-400'}`}>
                            +₱{price}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 bg-stone-50 border-t border-stone-100 flex items-center justify-between">
                <div>
                  <p className="text-stone-400 text-xs font-bold uppercase tracking-widest mb-1">Total Price</p>
                  <p className="text-3xl font-black text-stone-900">
                    ₱{selectedProductForVariations.basePrice + 
                      (selectedVariation ? selectedProductForVariations.variations[selectedVariation] : 0) +
                      selectedAddOns.reduce((sum, name) => sum + (selectedProductForVariations?.addOns[name] || 0), 0)
                    }
                  </p>
                </div>
                <button
                  onClick={() => handleAddToPending(selectedProductForVariations, selectedVariation, selectedAddOns)}
                  className="px-10 py-4 bg-stone-900 text-white rounded-2xl font-black hover:bg-stone-800 transition-all shadow-xl hover:shadow-2xl active:scale-95 flex items-center gap-3"
                >
                  <Plus className="w-5 h-5" />
                  Add to Order
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProductsView = ({ products, categories, ingredients, sales, currentUser }: { products: Product[], categories: Category[], ingredients: Ingredient[], sales: Sale[], currentUser: User }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isManagingCategories, setIsManagingCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // AI Scanning State
  const [isScanning, setIsScanning] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [isReviewingAI, setIsReviewingAI] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState('');

  const [newProduct, setNewProduct] = useState<Partial<Product>>({
    name: '',
    category: categories[0]?.name || '',
    basePrice: 0,
    variations: {},
    addOns: {},
    recipe: []
  });

  const [tempVariation, setTempVariation] = useState({ name: '', price: 0 });
  const [tempAddOn, setTempAddOn] = useState({ name: '', price: 0 });
  const [tempRecipe, setTempRecipe] = useState({ ingredientId: '', quantity: 0 });

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.category || newProduct.basePrice === undefined) return;
    try {
      await addDoc(collection(db, 'products'), {
        ...newProduct,
        ownerId: currentUser.isSuperAdmin ? null : currentUser.id,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateProduct = async () => {
    if (!editingId || !newProduct.name || !newProduct.category || newProduct.basePrice === undefined) return;
    try {
      const { id, ...data } = newProduct as any;
      await updateDoc(doc(db, 'products', editingId), data);
      setEditingId(null);
      resetForm();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await deleteDoc(doc(db, 'products', productToDelete));
      setProductToDelete(null);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setNewProduct({
      name: '',
      category: categories[0]?.name || '',
      basePrice: 0,
      variations: {},
      addOns: {},
      recipe: []
    });
    setTempVariation({ name: '', price: 0 });
    setTempAddOn({ name: '', price: 0 });
    setTempRecipe({ ingredientId: '', quantity: 0 });
  };

  const startEdit = (product: Product) => {
    setNewProduct(product);
    setEditingId(product.id);
  };

  const addVariation = () => {
    if (!tempVariation.name) return;
    setNewProduct({
      ...newProduct,
      variations: { ...newProduct.variations, [tempVariation.name]: tempVariation.price }
    });
    setTempVariation({ name: '', price: 0 });
  };

  const addAddOn = () => {
    if (!tempAddOn.name) return;
    setNewProduct({
      ...newProduct,
      addOns: { ...newProduct.addOns, [tempAddOn.name]: tempAddOn.price }
    });
    setTempAddOn({ name: '', price: 0 });
  };

  const addRecipeItem = () => {
    if (!tempRecipe.ingredientId || tempRecipe.quantity <= 0) return;
    setNewProduct({
      ...newProduct,
      recipe: [...(newProduct.recipe || []), { ...tempRecipe }]
    });
    setTempRecipe({ ingredientId: '', quantity: 0 });
  };

  const removeRecipeItem = (index: number) => {
    const updatedRecipe = [...(newProduct.recipe || [])];
    updatedRecipe.splice(index, 1);
    setNewProduct({ ...newProduct, recipe: updatedRecipe });
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const normalized = newCategoryName.trim();
    if (categories.some(c => c.name.toLowerCase() === normalized.toLowerCase())) {
      alert('Category already exists!');
      return;
    }
    try {
      await addDoc(collection(db, 'categories'), {
        name: normalized,
        ownerId: currentUser.isSuperAdmin ? null : currentUser.id,
        createdAt: new Date().toISOString()
      });
      setNewCategoryName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCategory = async () => {
    if (!editingCategoryId || !newCategoryName.trim()) return;
    try {
      await updateDoc(doc(db, 'categories', editingCategoryId), {
        name: newCategoryName.trim()
      });
      setEditingCategoryId(null);
      setNewCategoryName('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleAIScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    setScanError(null);
    setScanProgress('Uploading and analyzing menu...');

    try {
      const suggestions = await scanMenuWithAI(file);
      setAiSuggestions(suggestions);
      setIsReviewingAI(true);
    } catch (err: any) {
      setScanError(err.message || 'Failed to scan menu');
    } finally {
      setIsScanning(false);
      setScanProgress('');
    }
  };

  const confirmAISuggestion = async (suggestion: AISuggestion, index: number, localAddedCategories?: Set<string>) => {
    try {
      // 1. Ensure category exists
      const normalizedCategoryName = suggestion.category.trim();
      const existingCategory = categories.find(c => c.name.toLowerCase() === normalizedCategoryName.toLowerCase());
      
      const categoryToUse = existingCategory ? existingCategory.name : normalizedCategoryName;

      if (!existingCategory && (!localAddedCategories || !localAddedCategories.has(normalizedCategoryName.toLowerCase()))) {
        await addDoc(collection(db, 'categories'), {
          name: categoryToUse,
          ownerId: currentUser.isSuperAdmin ? null : currentUser.id,
          createdAt: new Date().toISOString()
        });
        if (localAddedCategories) {
          localAddedCategories.add(normalizedCategoryName.toLowerCase());
        }
      }

      // 2. Add product
      await addDoc(collection(db, 'products'), {
        name: suggestion.name.trim(),
        category: categoryToUse,
        basePrice: suggestion.price,
        variations: suggestion.variations || {},
        addOns: {},
        recipe: [],
        ownerId: currentUser.isSuperAdmin ? null : currentUser.id,
        createdAt: new Date().toISOString()
      });

      // 3. Remove from suggestions
      setAiSuggestions(prev => {
        const updated = [...prev];
        updated.splice(index, 1);
        return updated;
      });
      
      // We don't close the modal here if confirmed individually, 
      // unless it was the last one.
    } catch (err) {
      console.error(err);
    }
  };

  const confirmAllAISuggestions = async () => {
    setScanProgress('Adding all products...');
    const localAddedCategories = new Set<string>();
    try {
      // Process one by one to avoid race conditions with category creation
      // though we use localAddedCategories to mitigate this.
      for (let i = aiSuggestions.length - 1; i >= 0; i--) {
        await confirmAISuggestion(aiSuggestions[i], i, localAddedCategories);
      }
      setIsReviewingAI(false);
    } catch (err) {
      console.error(err);
    } finally {
      setScanProgress('');
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* AI Review Modal */}
      <AnimatePresence>
        {isReviewingAI && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-stone-100 flex items-center justify-between bg-amber-50/50">
                <div>
                  <h3 className="text-2xl font-black text-stone-900 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-amber-500" />
                    AI Menu Scan Results
                  </h3>
                  <p className="text-stone-500 text-sm">Review and confirm the items found in your menu</p>
                </div>
                <button 
                  onClick={() => setIsReviewingAI(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-stone-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8">
                {scanProgress && (
                  <div className="mb-6 p-4 bg-amber-100 text-amber-900 rounded-2xl flex items-center gap-3 font-bold animate-pulse">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {scanProgress}
                  </div>
                )}

                <div className="space-y-4">
                  {aiSuggestions.map((suggestion, index) => (
                    <div key={index} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100 hover:border-amber-200 transition-all group">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] uppercase tracking-widest font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                            {suggestion.category}
                          </span>
                        </div>
                        <h4 className="font-bold text-stone-900">{suggestion.name}</h4>
                        <p className="text-stone-500 font-mono text-sm">₱{suggestion.price}</p>
                        {suggestion.variations && Object.keys(suggestion.variations).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {Object.entries(suggestion.variations).map(([vName, vPrice]) => (
                              <span key={vName} className="text-[9px] font-bold bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md border border-stone-200">
                                {vName}: {(vPrice as number) >= 0 ? '+' : ''}₱{vPrice as number}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => confirmAISuggestion(suggestion, index)}
                        className="bg-white text-stone-900 px-4 py-2 rounded-xl font-bold border border-stone-200 shadow-sm hover:bg-stone-900 hover:text-white hover:border-stone-900 transition-all flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Confirm
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-8 bg-stone-50 border-t border-stone-100 flex gap-4">
                <button 
                  onClick={() => setIsReviewingAI(false)}
                  className="flex-1 px-6 py-4 rounded-2xl font-bold text-stone-500 hover:bg-stone-100 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmAllAISuggestions}
                  className="flex-[2] bg-stone-900 text-white px-6 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-stone-800 transition-all"
                >
                  <CheckCircle className="w-5 h-5" />
                  Confirm All ({aiSuggestions.length})
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-stone-900">Products</h2>
          <p className="text-stone-500">Manage your menu and recipes</p>
        </div>
        <div className="flex gap-4">
          <label className="cursor-pointer bg-amber-50 text-amber-900 px-6 py-3 rounded-2xl font-bold border border-amber-200 shadow-sm hover:bg-amber-100 transition-all flex items-center gap-2">
            {isScanning ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
            {isScanning ? 'Scanning...' : 'AI Scan Menu'}
            <input type="file" accept="image/*" onChange={handleAIScan} className="hidden" disabled={isScanning} />
          </label>
          <button 
            onClick={() => setIsManagingCategories(true)}
            className="bg-white text-stone-900 px-6 py-3 rounded-2xl font-bold border border-stone-200 shadow-sm hover:bg-stone-50 transition-all flex items-center gap-2"
          >
            <Settings className="w-5 h-5" />
            Categories
          </button>
          <button 
            onClick={() => { resetForm(); setIsAdding(true); }}
            className="bg-stone-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-stone-800 transition-all"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {productToDelete && (
            <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white rounded-[2rem] shadow-2xl w-full max-w-sm overflow-hidden p-8 text-center"
              >
                <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-stone-900 mb-2">Delete Product?</h3>
                <p className="text-stone-500 mb-8">This action cannot be undone. Are you sure you want to remove this product from your menu?</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setProductToDelete(null)}
                    className="flex-1 px-6 py-3 rounded-xl font-bold text-stone-500 hover:bg-stone-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleDeleteProduct}
                    className="flex-1 bg-red-500 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-red-200 hover:bg-red-600 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {products.map(product => {
          // Calculate cost per unit
          let unitCost = 0;
          product.recipe.forEach(r => {
            const ing = ingredients.find(i => i.id === r.ingredientId);
            if (ing && ing.unitAmount > 0) {
              unitCost += (ing.pricePerUnitAmount / ing.unitAmount) * r.quantity;
            }
          });
          const unitProfit = product.basePrice - unitCost;

          // Calculate total sales metrics for this product
          const productSalesItems = sales.flatMap(s => s.items).filter(item => item.productId === product.id);
          const totalRevenue = productSalesItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const totalNetProfit = productSalesItems.reduce((sum, item) => sum + ((item.price - item.cost) * item.quantity), 0);

          return (
            <div key={product.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <span className="text-[10px] uppercase tracking-widest font-black text-stone-400 mb-1 block">
                    {product.category}
                  </span>
                  <h3 className="text-lg font-bold text-stone-900">{product.name}</h3>
                </div>
                <div className="flex flex-col items-end">
                  <p className="text-xl font-black text-stone-900">₱{product.basePrice}</p>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => startEdit(product)} className="text-stone-400 hover:text-stone-900 transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setProductToDelete(product.id)} className="text-stone-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-stone-100">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400">Unit Cost</p>
                    <p className="font-bold text-stone-600">₱{unitCost.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-stone-400">Unit Profit</p>
                    <p className={`font-black ${unitProfit > 0 ? 'text-green-600' : 'text-red-600'}`}>₱{unitProfit.toFixed(2)}</p>
                  </div>
                </div>

                {product.recipe.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 mb-2">Recipe</p>
                    <div className="flex flex-wrap gap-2">
                      {product.recipe.map((item, i) => {
                        const ingredient = ingredients.find(ing => ing.id === item.ingredientId);
                        return (
                          <span key={i} className="text-[10px] bg-stone-50 text-stone-600 px-2 py-1 rounded-lg border border-stone-100">
                            {ingredient?.name}: {item.quantity}{ingredient?.unitName}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {Object.keys(product.variations).length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase font-bold text-stone-400 mb-2">Variations</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(product.variations).map(([name, price]) => (
                        <span key={name} className="text-[10px] bg-stone-900 text-white px-2 py-1 rounded-lg">
                          {name} (+₱{price})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {(isAdding || editingId) && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-8 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-stone-900">{editingId ? 'Edit Product' : 'New Product'}</h3>
                <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-stone-400 hover:text-stone-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-stone-700 mb-1">Product Name</label>
                  <input 
                    type="text" 
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    placeholder="e.g. Spanish Latte"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-bold text-stone-700 mb-1">Category</label>
                  <select 
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.name}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-stone-700 mb-1">Base Price (₱)</label>
                  <input 
                    type="number" 
                    value={newProduct.basePrice}
                    onChange={(e) => setNewProduct({ ...newProduct, basePrice: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                  />
                </div>
              </div>

              {/* Recipe Builder */}
              <div className="mb-6 p-6 bg-stone-50 rounded-2xl border border-stone-100">
                <h4 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Recipe (Ingredients)
                </h4>
                <div className="flex gap-2 mb-2">
                  <select 
                    value={tempRecipe.ingredientId}
                    onChange={(e) => setTempRecipe({ ...tempRecipe, ingredientId: e.target.value })}
                    className="flex-1 px-4 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none text-sm"
                  >
                    <option value="">Select Ingredient</option>
                    {ingredients.map(ing => (
                      <option key={ing.id} value={ing.id}>{ing.name} ({ing.unitName})</option>
                    ))}
                  </select>
                  <input 
                    type="number" 
                    placeholder="Qty"
                    value={tempRecipe.quantity || ''}
                    onChange={(e) => setTempRecipe({ ...tempRecipe, quantity: Number(e.target.value) })}
                    className="w-24 px-4 py-2 bg-white border border-stone-200 rounded-xl focus:outline-none text-sm"
                  />
                  <button 
                    onClick={addRecipeItem}
                    className="bg-stone-900 text-white px-4 rounded-xl font-bold text-sm"
                  >
                    Add
                  </button>
                </div>

                {tempRecipe.ingredientId && tempRecipe.quantity > 0 && (
                  <p className="text-xs text-stone-500 font-bold mb-4 px-1">
                    Estimated Line Cost: <span className="text-stone-900 text-sm">₱{(() => {
                      const ing = ingredients.find(i => i.id === tempRecipe.ingredientId);
                      return ing ? ((ing.pricePerUnitAmount / ing.unitAmount) * tempRecipe.quantity).toFixed(2) : '0.00';
                    })()}</span>
                  </p>
                )}

                <div className="space-y-2 mt-4">
                  {newProduct.recipe?.map((item, i) => {
                    const ing = ingredients.find(ing => ing.id === item.ingredientId);
                    const lineCost = ing ? (ing.pricePerUnitAmount / ing.unitAmount) * item.quantity : 0;
                    return (
                      <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border border-stone-100">
                        <div>
                          <p className="text-sm font-bold text-stone-900">{ing?.name}</p>
                          <p className="text-xs text-stone-400 font-bold uppercase">
                            {item.quantity} {ing?.unitName}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-base font-black text-stone-900">₱{lineCost.toFixed(2)}</span>
                          <button onClick={() => removeRecipeItem(i)} className="text-red-400 hover:text-red-600 p-2">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {newProduct.recipe && newProduct.recipe.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-stone-200 grid grid-cols-3 gap-4 items-center">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Recipe Cost</p>
                      <p className="text-xl font-black text-stone-900">
                        ₱{newProduct.recipe.reduce((sum, item) => {
                          const ing = ingredients.find(ing => ing.id === item.ingredientId);
                          return sum + (ing && ing.unitAmount > 0 ? (ing.pricePerUnitAmount / ing.unitAmount) * item.quantity : 0);
                        }, 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Gross Profit</p>
                      <p className="text-xl font-black text-stone-900">
                        ₱{(() => {
                          const totalCost = newProduct.recipe.reduce((sum, item) => {
                            const ing = ingredients.find(ing => ing.id === item.ingredientId);
                            return sum + (ing && ing.unitAmount > 0 ? (ing.pricePerUnitAmount / ing.unitAmount) * item.quantity : 0);
                          }, 0);
                          return ((newProduct.basePrice || 0) - totalCost).toFixed(2);
                        })()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-bold text-stone-400 tracking-widest">Margin</p>
                      <p className="text-lg font-bold text-green-600">
                        {(() => {
                          const totalCost = newProduct.recipe.reduce((sum, item) => {
                            const ing = ingredients.find(ing => ing.id === item.ingredientId);
                            return sum + (ing && ing.unitAmount > 0 ? (ing.pricePerUnitAmount / ing.unitAmount) * item.quantity : 0);
                          }, 0);
                          const basePrice = newProduct.basePrice || 0;
                          if (basePrice === 0) return '0%';
                          return (((basePrice - totalCost) / basePrice) * 100).toFixed(1) + '%';
                        })()}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Variations & Add-ons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100">
                  <h4 className="font-bold text-stone-900 mb-4">Variations (e.g. Sizes)</h4>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      placeholder="Name"
                      value={tempVariation.name}
                      onChange={(e) => setTempVariation({ ...tempVariation, name: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm"
                    />
                    <input 
                      type="number" 
                      placeholder="+₱"
                      value={tempVariation.price || ''}
                      onChange={(e) => setTempVariation({ ...tempVariation, price: Number(e.target.value) })}
                      className="w-20 px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm"
                    />
                    <button onClick={addVariation} className="bg-stone-900 text-white px-3 rounded-xl text-sm font-bold">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(newProduct.variations || {}).map(([name, price]) => (
                      <div key={name} className="bg-white px-3 py-1 rounded-lg border border-stone-200 text-xs flex items-center gap-2">
                        <span>{name}: +₱{price}</span>
                        <button onClick={() => {
                          const v = { ...newProduct.variations };
                          delete v[name];
                          setNewProduct({ ...newProduct, variations: v });
                        }} className="text-red-400">×</button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100">
                  <h4 className="font-bold text-stone-900 mb-4">Add-ons</h4>
                  <div className="flex gap-2 mb-4">
                    <input 
                      type="text" 
                      placeholder="Name"
                      value={tempAddOn.name}
                      onChange={(e) => setTempAddOn({ ...tempAddOn, name: e.target.value })}
                      className="flex-1 px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm"
                    />
                    <input 
                      type="number" 
                      placeholder="₱"
                      value={tempAddOn.price || ''}
                      onChange={(e) => setTempAddOn({ ...tempAddOn, price: Number(e.target.value) })}
                      className="w-20 px-3 py-2 bg-white border border-stone-200 rounded-xl text-sm"
                    />
                    <button onClick={addAddOn} className="bg-stone-900 text-white px-3 rounded-xl text-sm font-bold">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(newProduct.addOns || {}).map(([name, price]) => (
                      <div key={name} className="bg-white px-3 py-1 rounded-lg border border-stone-200 text-xs flex items-center gap-2">
                        <span>{name}: ₱{price}</span>
                        <button onClick={() => {
                          const a = { ...newProduct.addOns };
                          delete a[name];
                          setNewProduct({ ...newProduct, addOns: a });
                        }} className="text-red-400">×</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                onClick={editingId ? handleUpdateProduct : handleAddProduct}
                className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
              >
                <Save className="w-6 h-6" />
                {editingId ? 'Update Product' : 'Save Product'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Category Management Modal */}
      <AnimatePresence>
        {isManagingCategories && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-stone-900">Manage Categories</h3>
                <button onClick={() => { setIsManagingCategories(false); setEditingCategoryId(null); setNewCategoryName(''); }} className="text-stone-400 hover:text-stone-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                  placeholder="Category name..."
                />
                <button 
                  onClick={editingCategoryId ? handleUpdateCategory : handleAddCategory}
                  className="bg-stone-900 text-white px-6 rounded-xl font-bold"
                >
                  {editingCategoryId ? 'Update' : 'Add'}
                </button>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl group">
                    <span className="font-bold text-stone-900">{cat.name}</span>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => { setEditingCategoryId(cat.id); setNewCategoryName(cat.name); }}
                        className="text-stone-400 hover:text-stone-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-stone-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const InventoryView = ({ ingredients, products, currentUser }: { ingredients: Ingredient[], products: Product[], currentUser: User }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newIngredient, setNewIngredient] = useState<Partial<Ingredient>>({
    name: '',
    stockLevel: 0,
    unitAmount: 1,
    unitName: 'grams',
    pricePerUnitAmount: 0,
    lowStockThreshold: 100
  });

  const handleAdd = async () => {
    if (!newIngredient.name || !newIngredient.unitName || newIngredient.unitAmount === undefined || newIngredient.pricePerUnitAmount === undefined) return;
    try {
      await addDoc(collection(db, 'ingredients'), {
        ...newIngredient,
        ownerId: currentUser.isSuperAdmin ? null : currentUser.id,
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewIngredient({ name: '', stockLevel: 0, unitAmount: 1, unitName: 'grams', pricePerUnitAmount: 0, lowStockThreshold: 100 });
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !newIngredient.name) return;
    try {
      const { id, ...data } = newIngredient as any;
      await updateDoc(doc(db, 'ingredients', editingId), data);
      setEditingId(null);
      setNewIngredient({ name: '', stockLevel: 0, unitAmount: 1, unitName: 'grams', pricePerUnitAmount: 0, lowStockThreshold: 100 });
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    // if (!confirm('Are you sure you want to delete this ingredient?')) return;
    try {
      await deleteDoc(doc(db, 'ingredients', id));
    } catch (err) {
      console.error(err);
    }
  };

  const updateStock = async (id: string, current: number, delta: number) => {
    try {
      await updateDoc(doc(db, 'ingredients', id), { stockLevel: current + delta });
    } catch (err) {
      console.error(err);
    }
  };

  const startEdit = (ing: Ingredient) => {
    setNewIngredient(ing);
    setEditingId(ing.id);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-stone-900">Inventory</h2>
          <p className="text-stone-500">Manage ingredients and stock levels</p>
        </div>
        <button 
          onClick={() => {
            setNewIngredient({ name: '', stockLevel: 0, unitAmount: 1, unitName: 'grams', pricePerUnitAmount: 0, lowStockThreshold: 100 });
            setIsAdding(true);
          }}
          className="bg-stone-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-stone-800 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Ingredient
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {ingredients.map(ing => (
          <div key={ing.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-bold text-stone-900">{ing.name}</h3>
                <p className="text-stone-400 text-[10px] uppercase tracking-widest font-bold">
                  Price: ₱{ing.pricePerUnitAmount} per {ing.unitAmount} {ing.unitName}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(ing)} className="text-stone-400 hover:text-stone-900 transition-colors">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(ing.id)} className="text-stone-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-end justify-between mb-6">
              <div>
                <p className={`text-3xl font-black ${ing.stockLevel <= ing.lowStockThreshold ? 'text-red-500' : 'text-stone-900'}`}>
                  {ing.stockLevel}
                </p>
                <p className="text-stone-500 text-sm">{ing.unitName} Available</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-stone-900">₱{ing.unitAmount > 0 ? (ing.pricePerUnitAmount / ing.unitAmount).toFixed(2) : '0.00'}</p>
                <p className="text-stone-500 text-[10px]">Cost per 1 {ing.unitName}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => updateStock(ing.id, ing.stockLevel, -100)}
                className="flex-1 bg-stone-50 hover:bg-stone-100 text-stone-600 py-3 rounded-xl font-bold transition-all"
              >
                -100
              </button>
              <button 
                onClick={() => updateStock(ing.id, ing.stockLevel, 100)}
                className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-bold transition-all"
              >
                +100
              </button>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {(isAdding || editingId) && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-stone-900">{editingId ? 'Edit Ingredient' : 'New Ingredient'}</h3>
                <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-stone-400 hover:text-stone-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Ingredient Name</label>
                  <input 
                    type="text" 
                    value={newIngredient.name}
                    onChange={(e) => setNewIngredient({ ...newIngredient, name: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                    placeholder="e.g. Espresso Beans"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-1">Unit Amount</label>
                    <input 
                      type="number" 
                      value={newIngredient.unitAmount}
                      onChange={(e) => setNewIngredient({ ...newIngredient, unitAmount: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                      placeholder="e.g. 100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-1">Unit Name</label>
                    <input 
                      type="text" 
                      value={newIngredient.unitName}
                      onChange={(e) => setNewIngredient({ ...newIngredient, unitName: e.target.value })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                      placeholder="e.g. grams"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-1">Price (₱)</label>
                    <input 
                      type="number" 
                      value={newIngredient.pricePerUnitAmount}
                      onChange={(e) => setNewIngredient({ ...newIngredient, pricePerUnitAmount: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                      placeholder="Price for the unit amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-stone-700 mb-1">Initial Stock</label>
                    <input 
                      type="number" 
                      value={newIngredient.stockLevel}
                      onChange={(e) => setNewIngredient({ ...newIngredient, stockLevel: Number(e.target.value) })}
                      className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Low Stock Alert at</label>
                  <input 
                    type="number" 
                    value={newIngredient.lowStockThreshold}
                    onChange={(e) => setNewIngredient({ ...newIngredient, lowStockThreshold: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                  />
                </div>

                <button 
                  onClick={editingId ? handleUpdate : handleAdd}
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-black text-lg shadow-xl hover:bg-stone-800 transition-all flex items-center justify-center gap-2"
                >
                  <Save className="w-6 h-6" />
                  {editingId ? 'Update Ingredient' : 'Save Ingredient'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DashboardView = ({ sales, products, ingredients }: { sales: Sale[], products: Product[], ingredients: Ingredient[] }) => {
  const todaySales = sales.filter(s => isWithinInterval(new Date(s.timestamp), {
    start: startOfDay(new Date()),
    end: endOfDay(new Date())
  }));

  const totalRevenue = todaySales.reduce((sum, s) => sum + (s.total || 0), 0);
  const totalProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
  const totalOrders = todaySales.length;

  // Calculate top products
  const productSales: Record<string, number> = {};
  sales.forEach(sale => {
    sale.items.forEach(item => {
      productSales[item.productName] = (productSales[item.productName] || 0) + item.quantity;
    });
  });

  const topProducts = Object.entries(productSales)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-stone-900">Dashboard</h2>
        <p className="text-stone-500">Business performance at a glance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
              <DollarSign className="text-stone-900 w-6 h-6" />
            </div>
            <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Today's Revenue</p>
          </div>
          <p className="text-4xl font-black text-stone-900">₱{totalRevenue.toLocaleString()}</p>
          <div className="flex items-center gap-1 text-green-500 text-sm font-bold mt-2">
            <TrendingUp className="w-4 h-4" />
            <span>+12.5% from yesterday</span>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
              <TrendingUp className="text-stone-900 w-6 h-6" />
            </div>
            <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Today's Profits</p>
          </div>
          <p className="text-4xl font-black text-stone-900">₱{totalProfit.toLocaleString()}</p>
          <p className="text-stone-400 text-sm font-bold mt-2">Margin: {totalRevenue ? ((totalProfit/totalRevenue)*100).toFixed(1) : 0}%</p>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-stone-100 rounded-2xl flex items-center justify-center">
              <ShoppingBag className="text-stone-900 w-6 h-6" />
            </div>
            <p className="text-stone-500 font-bold uppercase tracking-widest text-xs">Total Orders</p>
          </div>
          <p className="text-4xl font-black text-stone-900">{totalOrders}</p>
          <p className="text-stone-400 text-sm font-bold mt-2">Avg. Ticket: ₱{totalOrders ? (totalRevenue/totalOrders).toFixed(0) : 0}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-xl font-black text-stone-900 mb-6">Top Selling Items</h3>
          <div className="space-y-6">
            {topProducts.map(([name, qty], i) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="w-8 h-8 bg-stone-100 rounded-lg flex items-center justify-center font-bold text-stone-500 text-sm">
                    {i + 1}
                  </span>
                  <p className="font-bold text-stone-900">{name}</p>
                </div>
                <p className="font-black text-stone-900">{qty} sold</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-stone-200 shadow-sm">
          <h3 className="text-xl font-black text-stone-900 mb-6">Product Margins</h3>
          <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
            {products.map(p => {
              // Calculate cost
              let cost = 0;
              // This is a simplified cost calculation for the dashboard
              // In a real app, you'd calculate this based on the latest ingredient costs
              p.recipe.forEach(r => {
                const ing = ingredients.find(i => i.id === r.ingredientId);
                if (ing && ing.unitAmount > 0) {
                  cost += (ing.pricePerUnitAmount / ing.unitAmount) * r.quantity;
                }
              });
              
              const margin = p.basePrice > 0 ? ((p.basePrice - cost) / p.basePrice * 100).toFixed(1) : '0';

              return (
                <div key={p.id} className="flex items-center justify-between p-3 hover:bg-stone-50 rounded-2xl transition-colors">
                  <div>
                    <p className="font-bold text-stone-900">{p.name}</p>
                    <p className="text-stone-400 text-xs uppercase tracking-widest font-bold">{p.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-stone-900">₱{p.basePrice}</p>
                    <p className={`text-xs font-bold ${Number(margin) > 50 ? 'text-green-500' : 'text-orange-500'}`}>
                      {margin}% Margin
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const StaffView = ({ currentUser }: { currentUser: User }) => {
  const [staff, setStaff] = useState<User[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '',
    pin: '',
    role: 'cashier'
  });

  useEffect(() => {
    const ownerId = currentUser.isSuperAdmin ? null : currentUser.id;
    const q = ownerId 
      ? query(collection(db, 'users'), where('ownerId', '==', ownerId))
      : collection(db, 'users');

    const unsub = onSnapshot(q, (snapshot) => {
      setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    }, (error) => {
      if (!(error instanceof Error && error.message.includes('permission-denied'))) {
        handleFirestoreError(error, OperationType.GET, 'users');
      }
    });
    return () => unsub();
  }, [currentUser]);

  const handleAdd = async () => {
    if (!newUser.name || !newUser.pin) return;
    try {
      await addDoc(collection(db, 'users'), {
        ...newUser,
        ownerId: currentUser.id,
        status: 'active', // Cashiers created by admins are active by default
        createdAt: new Date().toISOString()
      });
      setIsAdding(false);
      setNewUser({ name: '', pin: '', role: 'cashier' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-stone-900">Staff Management</h2>
          <p className="text-stone-500">Manage team members and access roles</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-stone-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-stone-800 transition-all"
        >
          <Plus className="w-5 h-5" />
          Add Staff
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {staff.map(member => (
          <div key={member.id} className="bg-white p-6 rounded-3xl border border-stone-200 shadow-sm hover:shadow-md transition-all flex items-center gap-4">
            <div className="w-16 h-16 bg-stone-100 rounded-2xl flex items-center justify-center">
              <UserIcon className="text-stone-400 w-8 h-8" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-stone-900">{member.name}</h3>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded-full ${
                  member.role === 'admin' ? 'bg-stone-900 text-white' : 'bg-stone-200 text-stone-600'
                }`}>
                  {member.role}
                </span>
                <span className="text-stone-400 text-[10px] font-bold">PIN: ****</span>
              </div>
            </div>
            <button className="text-stone-300 hover:text-stone-900 transition-colors">
              <Edit className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-black text-stone-900">New Staff Member</h3>
                <button onClick={() => setIsAdding(false)} className="text-stone-400 hover:text-stone-900">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Full Name</label>
                  <input 
                    type="text" 
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Login PIN (4-6 digits)</label>
                  <input 
                    type="password" 
                    maxLength={6}
                    value={newUser.pin}
                    onChange={(e) => setNewUser({ ...newUser, pin: e.target.value })}
                    className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                    placeholder="****"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1">Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['cashier', 'admin'] as const).map(role => (
                      <button
                        key={role}
                        onClick={() => setNewUser({ ...newUser, role })}
                        className={`py-3 rounded-xl font-bold capitalize transition-all ${
                          newUser.role === role 
                            ? 'bg-stone-900 text-white shadow-lg' 
                            : 'bg-stone-50 text-stone-500 border border-stone-200 hover:bg-stone-100'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>
                <button 
                  onClick={handleAdd}
                  className="w-full bg-stone-900 text-white py-4 rounded-2xl font-bold text-lg shadow-xl hover:bg-stone-800 transition-all mt-4"
                >
                  Create Account
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
