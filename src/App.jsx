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
  const [newBit, setNewBit] = useState({ name: "", description: "" });
  const [page, setPage] = useState("leaderboard");

  // Watch for auth state changes
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => setUser(user));
    return () => unsub();
  }, []);

  // Watch Firestore bits collection
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "bits"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      setBits(data);
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
            <p>{bits.filter((b) => b.authorId === user.uid).length}</p>
          </div>
          <div className="stat small">
            <h4>Avg Rating</h4>
            <p>
              {(() => {
                const myBits = bits.filter((b) => b.authorId === user.uid);
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

      {/* Main Grid */}
      <div className="content-grid">
        <div className="my-bits">
          <h2>My Bits</h2>
          {bits
            .filter((b) => b.authorId === user.uid)
            .map((bit) => (
              <div key={bit.id} className="bit-card">
                <h3>{bit.name}</h3>
                <p>{bit.description}</p>
                <p>⭐ {bit.rating ? bit.rating.toFixed(1) : "No ratings"}</p>
              </div>
            ))}
        </div>

        <div className="leaderboard">
          <h2>Leaderboard</h2>
          {bits.length === 0 ? (
            <p>No bits yet!</p>
          ) : (
            bits.map((bit) => (
              <div key={bit.id} className="bit-card">
                <h3>{bit.name}</h3>
                <p>{bit.description}</p>
                <p>By: {bit.author || "Unknown"}</p>
                <p>⭐ {bit.rating ? bit.rating.toFixed(1) : "No ratings"}</p>
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
            ))
          )}
        </div>
      </div>

      {/* Add Bit Form */}
      {page === "add" && (
        <div className="add-bit-form">
          <h2>Add a New Bit</h2>
          <input
            placeholder="Bit title"
            value={newBit.name}
            onChange={(e) => setNewBit({ ...newBit, name: e.target.value })}
          />
          <textarea
            placeholder="Describe your bit..."
            value={newBit.description}
            onChange={(e) =>
              setNewBit({ ...newBit, description: e.target.value })
            }
          />
          <button onClick={addBit}>Submit</button>
          <button onClick={() => setPage("leaderboard")}>Cancel</button>
        </div>
      )}
    </div>
  );

}
