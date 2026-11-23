import { Request, Response, NextFunction } from 'express';
import { DecodedIdToken } from 'firebase-admin/auth';
import { eq, sql } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { profiles } from '../db/schema.ts';

export type UserRole = 'admin' | 'petugas';

export interface UserProfile {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
}

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  profile?: UserProfile;
}

const INITIAL_ADMIN_EMAIL = 'bintangprakasa22@gmail.com';

async function getOrCreateProfile(decoded: DecodedIdToken): Promise<UserProfile> {
  const uid = decoded.uid;
  const email = (decoded.email || '').toLowerCase();
  const fullName = decoded.name || email.split('@')[0] || 'Pengguna Apotek';

  // 1. Check by Firebase UID first
  const existingByUid = await db
    .select()
    .from(profiles)
    .where(eq(profiles.uid, uid))
    .limit(1);

  if (existingByUid.length > 0) {
    const p = existingByUid[0];
    return {
      id: p.id,
      uid: p.uid,
      email: p.email,
      fullName: p.fullName,
      role: (p.role === 'admin' ? 'admin' : 'petugas') as UserRole,
      isActive: p.isActive,
    };
  }

  // 2. Check if admin pre-registered this email with a pending UID
  if (email) {
    const existingByEmail = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    if (existingByEmail.length > 0) {
      const updated = await db
        .update(profiles)
        .set({
          uid,
          fullName: existingByEmail[0].fullName || fullName,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, existingByEmail[0].id))
        .returning();

      const p = updated[0];
      return {
        id: p.id,
        uid: p.uid,
        email: p.email,
        fullName: p.fullName,
        role: (p.role === 'admin' ? 'admin' : 'petugas') as UserRole,
        isActive: p.isActive,
      };
    }
  }

  // 3. Determine default role: initial owner email or very first user in system becomes admin
  const countRes = await db.select({ count: sql<number>`count(*)::int` }).from(profiles);
  const totalProfiles = countRes[0]?.count ?? 0;
  const assignedRole: UserRole =
    email === INITIAL_ADMIN_EMAIL || totalProfiles === 0 ? 'admin' : 'petugas';

  const inserted = await db
    .insert(profiles)
    .values({
      uid,
      email,
      fullName,
      role: assignedRole,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: profiles.uid,
      set: {
        email,
        updatedAt: new Date(),
      },
    })
    .returning();

  const p = inserted[0];
  return {
    id: p.id,
    uid: p.uid,
    email: p.email,
    fullName: p.fullName,
    role: (p.role === 'admin' ? 'admin' : 'petugas') as UserRole,
    isActive: p.isActive,
  };
}

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Akses ditolak: Token autentikasi tidak ditemukan.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    const profile = await getOrCreateProfile(decodedToken);
    if (!profile.isActive) {
      return res.status(403).json({
        error: 'Akun Anda sedang dinonaktifkan oleh Admin. Hubungi administrator apotek.',
      });
    }
    req.profile = profile;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Sesi tidak valid atau kedaluwarsa. Silakan masuk ulang.' });
  }
};

export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.profile) {
      return res.status(401).json({ error: 'Autentikasi diperlukan.' });
    }
    if (!allowedRoles.includes(req.profile.role)) {
      return res.status(403).json({
        error: 'Izin ditolak: Fitur ini hanya dapat diakses oleh role Admin.',
      });
    }
    next();
  };
};
