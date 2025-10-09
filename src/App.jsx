import React, { useState, useEffect } from "react";
import "./App.css";

import { setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import { updateProfile } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";

export default function App() {
  const [user, setUser] = useState(null);
  const [bits, setBits] = useState([]);
  const [users, setUsers] = useState([]);
  const [newBit, setNewBit] = useState({ name: "", description: "" });
  const [page, setPage] = useState("leaderboard");
  const [sortMode, setSortMode] = useState("avg"); // 'avg' | 'votes'
  const [assignForm, setAssignForm] = useState({ bitId: "", username: "" });

  const ADMIN_UID = import.meta.env.VITE_ADMIN_UID || "";
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || "";
  const isAdmin =
    !!user && (
      (!!ADMIN_UID && user.uid === ADMIN_UID) || (!!ADMIN_EMAIL && user.email === ADMIN_EMAIL)
    );

  // Resolve a human-friendly name for a user id with fallback to provided default
  const displayNameFor = (uid, fallback) => {
    const u = users.find((x) => x.id === uid);
    return (u && (u.displayName || u.email)) || fallback || "Unknown";
  };

  // Normalization and ownership helpers
  const norm = (s) => (s || "").trim().toLowerCase();
  const ownerName = (bit) => (bit.author && bit.author.trim()) || displayNameFor(bit.authorId, bit.author) || "Unknown";
  const currentUserName = () => ((user?.displayName || (user?.email ? user.email.split("@")[0] : "")) || "").trim();
  const isOwnedByCurrent = (bit) => {
    if (!user) return false;
    // Only count when the displayed owner name matches the bit's author name logic,
    // matching the same rule used by Top Bitters aggregation.
    return norm(ownerName(bit)) === norm(currentUserName());
  };

  // Watch for auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUser(user));
    return () => unsub();
  }, []);

  // Watch Firestore bits collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bits"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setBits(data);
    });
    return () => unsub();
  }, []);

  // Watch Firestore users collection (for username-based assignment)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setUsers(list);
    });
    return () => unsub();
  }, []);

  // Auth
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async () => {
    try {
      if (isRegistering) {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const newUser = userCredential.user;
        const nameFromEmail = email.split("@")[0];
        await updateProfile(newUser, { displayName: nameFromEmail });
        await setDoc(doc(db, "users", newUser.uid), {
          displayName: nameFromEmail,
          email: newUser.email,
          createdAt: new Date(),
        });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  // Add a new bit
  const addBit = async () => {
    if (!newBit.name || !newBit.description) return;
    await addDoc(collection(db, "bits"), {
      name: newBit.name,
      description: newBit.description,
      author: user.displayName,
      authorId: user.uid,
      rating: 0,
      ratings: {},
    });
    setNewBit({ name: "", description: "" });
    setPage("leaderboard");
  };

  // Rate a bit
  const rateBit = async (bit, stars) => {
    const newRatings = { ...(bit.ratings || {}), [user.uid]: stars };
    const allRatings = Object.values(newRatings);
    const avgRating =
      allRatings.reduce((a, b) => a + b, 0) / allRatings.length;

    await updateDoc(doc(db, "bits", bit.id), {
      ratings: newRatings,
      rating: avgRating,
    });
  };

  // Assign a bit to a user by username (maps to uid under the hood)
  const assignBitToUsername = async () => {
    if (!isAdmin) {
      alert("Only the admin can reassign bits.");
      return;
    }
    if (!assignForm.bitId || !assignForm.username) return;
    const nameInput = assignForm.username.trim();
    const matches = users.filter(
      (u) => (u.displayName || "").toLowerCase() === assignForm.username.trim().toLowerCase()
    );
    if (matches.length > 1) {
      alert("Multiple users share that username. Please disambiguate or use a unique username.");
      return;
    }
    const targetUser = matches[0];
    if (!targetUser) {
      // No matching account — assign by name only (no uid)
      try {
        await updateDoc(doc(db, "bits", assignForm.bitId), {
          author: nameInput,
          authorId: "",
        });
        setAssignForm({ bitId: "", username: "" });
        alert("Bit reassigned to name (no account).");
      } catch (e) {
        alert("Failed to reassign bit: " + e.message);
      }
      return;
    }
    try {
      await updateDoc(doc(db, "bits", assignForm.bitId), {
        author: targetUser.displayName || targetUser.email || "Unknown",
        authorId: targetUser.id,
      });
      setAssignForm({ bitId: "", username: "" });
      alert("Bit reassigned successfully.");
    } catch (e) {
      alert("Failed to reassign bit: " + e.message);
    }
  };

  // -----------------------------
  // LOGIN / REGISTER VIEW
  // -----------------------------
  if (!user) {
    return (
      <div style={{ textAlign: "center", marginTop: "5rem" }}>
        <h1> BitHub</h1>
        <p>{isRegistering ? "Create an Account" : "Log In to BitHub"}</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <br />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <br />
        <button onClick={handleAuth}>
          {isRegistering ? "Sign Up" : "Log In"}
        </button>
        <p style={{ marginTop: "1rem" }}>
          {isRegistering ? "Already have an account?" : "Need an account?"}{" "}
          <span
            style={{ color: "blue", cursor: "pointer" }}
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? "Log in" : "Register"}
          </span>
        </p>
      </div>
    );
  }

  // -----------------------------
  // DASHBOARD VIEW
  // -----------------------------
  // -----------------------------
  // DASHBOARD VIEW
  // -----------------------------
  return (
    <div className="app-container dashboard">
    <header className="dashboard-header light">
    <div className="logo-title">
      <div className="logo-triangle">
        <svg
          width="26"
          height="26"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon
            points="50,5 95,95 5,95"
            fill="url(#grad)"
          />
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00b5c7" />
              <stop offset="100%" stopColor="#007a8c" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      <h1>BitHub</h1>
    </div>

      <div className="user-info">
        <span className="user-name">{user.displayName || user.email}</span>
        <button onClick={logout} className="logout-btn">Logout</button>
      </div>
    </header>


      {/* 🧠 My Stats */}
          <div className="stats-container">
      <div className="stats-group">
        <h2>My Stats</h2>
        <div className="stats-row">
          <div className="stat small">
            <h4>Bits</h4>
            <p>{bits.filter((b) => isOwnedByCurrent(b)).length}</p>
          </div>
          <div className="stat small">
            <h4>Avg Rating</h4>
            <p>
              {(() => {
                const myBits = bits.filter((b) => isOwnedByCurrent(b));
                if (myBits.length === 0) return "—";
                const avg =
                  myBits.reduce((sum, b) => sum + (b.rating || 0), 0) /
                  myBits.length;
                return avg.toFixed(1);
              })()}
            </p>
          </div>
          <div className="stat small">
            <h4>Ratings Given</h4>
            <p>{bits.filter((b) => b.ratings && b.ratings[user.uid]).length}</p>
          </div>
        </div>
      </div>

      <div className="stats-group">
        <h2>Global Stats</h2>
        <div className="stats-row">
          <div className="stat small">
            <h4>Total Bits</h4>
            <p>{bits.length}</p>
          </div>
          <div className="stat small">
            <h4>Avg Rating</h4>
            <p>
              {bits.length > 0
                ? (
                    bits.reduce((sum, b) => sum + (b.rating || 0), 0) /
                    bits.length
                  ).toFixed(1)
                : "—"}
            </p>
          </div>
          <div className="stat small">
            <h4>Users</h4>
            <p>{new Set(bits.map((b) => b.authorId)).size}</p>
          </div>
        </div>
      </div>
    </div>
      <div className="add-bit-bar">
        <button onClick={() => setPage("add")}>Add Bit</button>
      </div>
      {page === "add" && (
        <div className="add-bit-form" style={{ marginTop: "0.5rem" }}>
          <h2>Add a New Bit</h2>
          <input
            placeholder="Bit title"
            value={newBit.name}
            onChange={(e) => setNewBit({ ...newBit, name: e.target.value })}
          />
          <textarea
            placeholder="Describe your bit..."
            value={newBit.description}
            onChange={(e) => setNewBit({ ...newBit, description: e.target.value })}
          />
          <button onClick={addBit}>Submit</button>
          <button onClick={() => setPage("leaderboard")}>Cancel</button>
        </div>
      )}

      {/* Top Bitters (moved above grid) */}
      <div className="stats-group" style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
        <h2>Top Bitters</h2>
        {(() => {
          if (bits.length === 0) return <p>No bits yet.</p>;
          // Aggregate by assigned name on the bit (preferred),
          // falling back to resolved display name when no explicit author string.
          const norm = (s) => (s || "").trim().toLowerCase();
          const byName = new Map();
          for (const b of bits) {
            const name = (b.author && b.author.trim()) || displayNameFor(b.authorId, b.author) || "Unknown";
            const key = `name:${norm(name)}`;
            const entry = byName.get(key) || {
              nameDisplay: name,
              count: 0,
              avgSum: 0,
            };
            entry.count += 1;
            entry.avgSum += b.rating || 0;
            if (!byName.has(key)) entry.nameDisplay = name;
            byName.set(key, entry);
          }
          const list = Array.from(byName.values()).map((e) => ({
            ...e,
            avg: e.count > 0 ? e.avgSum / e.count : 0,
          }));
          const topByCount = [...list].sort((a, b) => b.count - a.count || b.avg - a.avg).slice(0, 5);
          const topByAvg = [...list]
            .filter((e) => e.count > 0)
            .sort((a, b) => b.avg - a.avg || b.count - a.count)
            .slice(0, 5);
          return (
            <div className="stats-row" style={{ alignItems: "flex-start" }}>
              <div className="stat small" style={{ textAlign: "left" }}>
                <h4>Most Bits</h4>
                {topByCount.length === 0 ? (
                  <p>—</p>
                ) : (
                  topByCount.map((u, idx) => (
                    <p key={`count-${idx}`}>{u.nameDisplay}: {u.count} bits • {(u.avg).toFixed(1)} avg</p>
                  ))
                )}
              </div>
              <div className="stat small" style={{ textAlign: "left" }}>
                <h4>Highest Avg</h4>
                {topByAvg.length === 0 ? (
                  <p>—</p>
                ) : (
                  topByAvg.map((u, idx) => (
                    <p key={`avg-${idx}`}>{u.nameDisplay}: {(u.avg).toFixed(2)} • {u.count} bits</p>
                  ))
                )}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Main Grid */}
      <div className="content-grid">
        <div className="my-bits">
          <h2>My Bits</h2>
          {bits
            .filter((b) => isOwnedByCurrent(b))
            .map((bit) => {
              const ratingCount = Object.keys(bit.ratings || {}).length;
              const hasRatings = ratingCount > 0;
              return (
                <div key={bit.id} className="bit-card">
                  <h3>{bit.name}</h3>
                  <p>{bit.description}</p>
                  <p>
                    ⭐{" "}
                    {hasRatings
                      ? `${(bit.rating || 0).toFixed(1)} (${ratingCount})`
                      : "No ratings"}
                  </p>
                </div>
              );
            })}
        </div>

        <div className="leaderboard">
          <h2>Leaderboard</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <span style={{ fontSize: "0.9rem", color: "#555" }}>Sort by:</span>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="avg">Highest average rating</option>
              <option value="votes">Most votes</option>
            </select>
          </div>
          {bits.length === 0 ? (
            <p>No bits yet!</p>
          ) : (
            [...bits]
              .sort((a, b) => {
                if (sortMode === "votes") {
                  const va = Object.keys(a.ratings || {}).length;
                  const vb = Object.keys(b.ratings || {}).length;
                  if (vb !== va) return vb - va;
                  // tie-breaker by rating desc
                  return (b.rating || 0) - (a.rating || 0);
                }
                // default: sort by avg rating desc then votes
                const ra = a.rating || 0;
                const rb = b.rating || 0;
                if (rb !== ra) return rb - ra;
                const va = Object.keys(a.ratings || {}).length;
                const vb = Object.keys(b.ratings || {}).length;
                return vb - va;
              })
              .map((bit) => {
              const ratingCount = Object.keys(bit.ratings || {}).length;
              const hasRatings = ratingCount > 0;
              return (
                <div key={bit.id} className="bit-card">
                  <h3>{bit.name}</h3>
                  <p>{bit.description}</p>
                  <p>By: {(bit.author && bit.author.trim()) || displayNameFor(bit.authorId, bit.author)}</p>
                  <p>
                    ⭐{" "}
                    {hasRatings
                      ? `${(bit.rating || 0).toFixed(1)} (${ratingCount})`
                      : "No ratings"}
                  </p>
                  <div>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        onClick={() => rateBit(bit, star)}
                        className={`star ${
                          star <= (bit.ratings?.[user.uid] || 0) ? "gold" : ""
                        }`}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      

      {/* Assign Bit Owner */}
      {isAdmin && (
        <div className="stats-group" style={{ marginTop: "1rem" }}>
          <h2>Assign Bit Owner</h2>
          <div className="stats-row" style={{ gap: "0.5rem" }}>
            <div className="stat small" style={{ flex: 2 }}>
              <select
                value={assignForm.bitId}
                onChange={(e) => setAssignForm({ ...assignForm, bitId: e.target.value })}
              >
                <option value="">Select a bit…</option>
                {bits.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — current: {b.author || "Unknown"}
                  </option>
                ))}
              </select>
            </div>
            <div className="stat small" style={{ flex: 2 }}>
              <input
                placeholder="New owner's username or name"
                value={assignForm.username}
                onChange={(e) => setAssignForm({ ...assignForm, username: e.target.value })}
              />
            </div>
            <div className="stat small" style={{ flex: 1 }}>
              <button onClick={assignBitToUsername} disabled={!assignForm.bitId || !assignForm.username}>
                Assign
              </button>
            </div>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#555", marginTop: "0.3rem" }}>
            Admin-only. Uses usernames for lookup but stores the stable user ID internally.
          </p>
        </div>
      )}

      
    </div>
  );

}
