import { useEffect, useRef, useState } from "react";
import "./App.css";

import {
  getProfile,
  createProfile,
  updateProfile,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress as deleteAddressAPI,
  setDefaultAddress,
  getSettings,
  updateSettings
} from "./api";

const defaultProfile = {
  name: "Ravi Sharma",
  phone: "9876543210",
  email: "ravi.sharma@gmail.com",
  photo: ""
};

const defaultSettings = {
  notifications: true,
  privacy: true,
  language: "English"
};

const digits = value =>
  String(value || "").replace(/\D/g, "").replace(/^91(?=\d{11})/, "").slice(0, 10);

const phoneFormat = value => {
  const number = digits(value);
  return `+91 ${number.slice(0, 5)}${number.length > 5 ? " " + number.slice(5) : ""}`;
};

const dateFormat = value => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

const emailValid = value =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());

function PhoneInput({ value, onChange }) {
  const number = digits(value);

  return (
    <div className="phone-input">
      <span>+91</span>
      <input
        type="tel"
        inputMode="numeric"
        maxLength={11}
        placeholder="97656 97656"
        value={number.length > 5 ? `${number.slice(0, 5)} ${number.slice(5)}` : number}
        onChange={e => onChange(digits(e.target.value))}
        required
      />
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState(defaultProfile);
  const [addresses, setAddresses] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [created, setCreated] = useState("");
  const [updated, setUpdated] = useState("");
  const [form, setForm] = useState(defaultProfile);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showAddress, setShowAddress] = useState(false);
  const [editAddress, setEditAddress] = useState(null);
  const [addressForm, setAddressForm] = useState({});
  const [deleteAddress, setDeleteAddress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [profileErrors, setProfileErrors] = useState({});
  const [addressErrors, setAddressErrors] = useState({});
  const [showLeaveWarning, setShowLeaveWarning] = useState(false);

  const fileRef = useRef(null);
  const initialProfileForm = useRef(null);
  const initialAddressForm = useRef(null);

  useEffect(() => {
    let active = true;

    const loadData = async () => {
      try {
        let profileData = await getProfile();

        if (!profileData) {
          await createProfile(defaultProfile);
          profileData = await getProfile();
        }

        const [addressData, settingsData] = await Promise.all([
          getAddresses(),
          getSettings()
        ]);

        const response = await fetch("http://localhost:5000/api/profile");
        if (!response.ok) throw new Error("Unable to load profile dates.");
        const rawProfile = await response.json();

        if (!active) return;

        if (profileData) {
          setProfile(profileData);
          setForm(profileData);
          initialProfileForm.current = JSON.stringify(profileData);
        }

        setAddresses(addressData || []);
        setSettings(settingsData || defaultSettings);
        setCreated(rawProfile?.created_at || "");
        setUpdated(rawProfile?.updated_at || "");
      } catch (error) {
        if (active) setMessage(`Backend error: ${error.message}`);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadData();
    return () => {
      active = false;
    };
  }, []);

  const notify = text => setMessage(text);
  const touch = () => setUpdated(new Date().toISOString());

  const initials = (profile.name || "R")
    .trim()
    .split(/\s+/)
    .map(part => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const completion = Math.round((
    Number(Boolean(profile.name)) +
    Number(Boolean(profile.phone)) +
    Number(Boolean(profile.email)) +
    Number(Boolean(profile.photo))
  ) / 4 * 100);

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  };

  const validateProfile = () => {
    const errors = {};

    if (!form.name.trim()) errors.name = "Full name is required.";
    else if (form.name.trim().length < 2 || form.name.trim().length > 60) {
      errors.name = "Name must be between 2 and 60 characters.";
    }

    if (digits(form.phone).length !== 10) {
      errors.phone = "Enter a valid 10-digit mobile number.";
    }

    if (!emailValid(form.email)) {
      errors.email = "Enter a valid email address.";
    }

    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProfile = async e => {
    e.preventDefault();

    if (!validateProfile()) return;

    if (JSON.stringify(form) === JSON.stringify(profile)) {
      notify("No changes to save.");
      return;
    }

    try {
      setSaving(true);

      const nextProfile = {
        ...form,
        name: form.name.trim(),
        phone: digits(form.phone),
        email: form.email.trim()
      };

      await updateProfile(nextProfile);

      setProfile(nextProfile);
      setForm(nextProfile);
      initialProfileForm.current = JSON.stringify(nextProfile);
      setProfileErrors({});
      touch();
      notify("Profile updated successfully!");
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelProfileEdit = () => {
    setForm(profile);
    setProfileErrors({});
  };

  const uploadPhoto = e => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify("Please select a valid image.");
      e.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify("Image size must be 5 MB or less.");
      e.target.value = "";
      return;
    }

    setPhotoUploading(true);

    const reader = new FileReader();

    reader.onload = () => {
      const img = new Image();

      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(1, 600 / Math.max(img.width, img.height));

        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext("2d");

        if (!ctx) {
          notify("Unable to process this image.");
          setPhotoUploading(false);
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const photo = canvas.toDataURL("image/jpeg", 0.8);
        const nextProfile = { ...profile, photo };

        try {
          await updateProfile(nextProfile);
          setProfile(nextProfile);
          setForm(nextProfile);
          touch();
          notify("Profile photo uploaded successfully!");
        } catch (error) {
          notify(error.message);
        } finally {
          setPhotoUploading(false);
        }
      };

      img.onerror = () => {
        notify("Unable to open this image.");
        setPhotoUploading(false);
      };

      img.src = reader.result;
    };

    reader.onerror = () => {
      notify("Unable to read this image.");
      setPhotoUploading(false);
    };

    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const removePhoto = async () => {
    try {
      const nextProfile = { ...profile, photo: "" };
      await updateProfile(nextProfile);
      setProfile(nextProfile);
      setForm(nextProfile);
      touch();
      notify("Profile photo removed successfully!");
    } catch (error) {
      notify(error.message);
    }
  };

  const openAddAddress = () => {
    setEditAddress(null);

    const nextForm = {
      type: "Home",
      name: profile.name,
      phone: profile.phone,
      house: "",
      street: "",
      city: "",
      state: "",
      pin: "",
      isDefault: addresses.length === 0
    };

    setAddressForm(nextForm);
    initialAddressForm.current = JSON.stringify(nextForm);
    setAddressErrors({});
    setShowAddress(true);
  };

  const openEditAddress = address => {
    setEditAddress(address.id);
    setAddressForm({ ...address });
    initialAddressForm.current = JSON.stringify(address);
    setAddressErrors({});
    setShowAddress(true);
  };

  const validateAddress = () => {
    const errors = {};

    ["name", "house", "street", "city", "state"].forEach(key => {
      if (!String(addressForm[key] || "").trim()) {
        errors[key] = "This field is required.";
      }
    });

    if (digits(addressForm.phone).length !== 10) {
      errors.phone = "Enter a valid 10-digit mobile number.";
    }

    if (!/^\d{6}$/.test(String(addressForm.pin || ""))) {
      errors.pin = "Enter a valid 6-digit postal code.";
    }

    setAddressErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveAddress = async e => {
    e.preventDefault();

    if (!validateAddress()) return;

    try {
      setSaving(true);

      const payload = {
        ...addressForm,
        name: addressForm.name.trim(),
        phone: digits(addressForm.phone)
      };

      if (editAddress !== null) {
        await updateAddress(editAddress, payload);
      } else {
        await addAddress(payload);
      }

      const latestAddresses = await getAddresses();
      setAddresses(latestAddresses);
      setShowAddress(false);
      setEditAddress(null);
      setAddressErrors({});
      touch();

      notify(editAddress !== null
        ? "Address updated successfully!"
        : "Address added successfully!");
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  };

  const fullAddress = address =>
    [address.house, address.street, address.city, address.state]
      .filter(Boolean)
      .join(", ") + (address.pin ? ` - ${address.pin}` : "");

  const removeAddress = async () => {
    if (!deleteAddress) return;

    if (deleteAddress.isDefault && addresses.length > 1) {
      notify("Set another address as default before deleting.");
      setDeleteAddress(null);
      return;
    }

    try {
      setSaving(true);
      await deleteAddressAPI(deleteAddress.id);
      const latestAddresses = await getAddresses();
      setAddresses(latestAddresses);
      setDeleteAddress(null);
      touch();
      notify("Address deleted successfully!");
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async id => {
    try {
      setSaving(true);
      await setDefaultAddress(id);
      const latestAddresses = await getAddresses();
      setAddresses(latestAddresses);
      touch();
      notify("Default address updated successfully!");
    } catch (error) {
      notify(error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = async (key, value) => {
    const nextSettings = { ...settings, [key]: value };

    try {
      await updateSettings(nextSettings);
      setSettings(nextSettings);
      touch();
      notify("Account settings updated successfully!");
    } catch (error) {
      notify(error.message);
    }
  };

  const filteredAddresses = addresses.filter(address =>
    `${address.name} ${address.type} ${address.street} ${address.city}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="app-shell loading-screen">
        <div className="loading-card">
          <div className="loading-spinner" />
          Loading ShopEasy...
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span>🛒</span>
          <b>ShopEasy</b>
        </div>

        <nav>
          <button className="nav-item selected">♟ My Profile</button>
          <button className="nav-item" onClick={() => notify("No orders available in demo mode.")}>
            ♧ My Orders
          </button>
          <button className="nav-item" onClick={() => notify("Contact support@shopeasy.com")}>
            ♧ Support
          </button>
          <button className="nav-item" onClick={() => notify("Logout is not connected in demo mode.")}>
            ⇥ Logout
          </button>
        </nav>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <span>♧</span>
          <div className="top-avatar">{initials}</div>
        </header>

        <div className="dashboard">
          <section className="heading-row">
            <div>
              <h1>Customer Profile</h1>
              <p>Manage your personal information and addresses</p>
            </div>

            <div className="stats-card">
              <div className="completion-box">
                <div className="circle-progress" style={{ "--value": `${completion}%` }}>
                  <b>{completion}%</b>
                </div>
                <div className="completion-label">
                  <b>Profile Completion</b>
                  <div className="progress-track">
                    <span style={{ width: `${completion}%` }} />
                  </div>
                </div>
              </div>

              <div className="stat-separator" />

              <div className="stat-item">
                <span>▦</span>
                <div>
                  <small>Account Created</small>
                  <b>{dateFormat(created)}</b>
                </div>
              </div>

              <div className="stat-separator" />

              <div className="stat-item">
                <span>⟳</span>
                <div>
                  <small>Last Updated</small>
                  <b>{dateFormat(updated)}</b>
                </div>
              </div>
            </div>
          </section>

          <div className="tabs">
            <button className="tab active">♟ Personal Information</button>
            <button className="tab" onClick={() => scrollTo("addresses")}>📍 Address Management</button>
            <button className="tab" onClick={() => scrollTo("settings")}>⚙ Account Settings</button>
          </div>

          <section className="summary-grid">
            <div className="card profile-summary">
              <div className="summary-photo">
                {profile.photo
                  ? <img src={profile.photo} alt="Profile" />
                  : <div className="initial-avatar">{initials}</div>}
                <button className="camera" onClick={() => fileRef.current?.click()}>📷</button>
              </div>

              <div className="summary-details">
                <h2>
                  {profile.name}
                  <span className="verified-name">
                    <span className="verified-check">✓</span> Verified
                  </span>
                </h2>
                <p className="contact-row">
                  <span>☎ {phoneFormat(profile.phone)}</span>
                  <span className="verified-pill">✓ Verified</span>
                </p>
                <p className="contact-row">
                  <span>✉ {profile.email}</span>
                  <span className="not-verified-pill">● Not Verified</span>
                </p>
              </div>

              <button className="edit-profile-btn" onClick={() => scrollTo("edit-profile")}>
                ✎ Edit Profile
              </button>
            </div>

            <div className="card quick-settings">
              <h3>⚙ Quick Settings</h3>
              <button onClick={() => fileRef.current?.click()}>👤 Manage Profile Photo <b>›</b></button>
              <button onClick={() => scrollTo("addresses")}>📍 Manage Addresses <b>›</b></button>
              <button onClick={() => scrollTo("settings")}>▣ Update Account Settings <b>›</b></button>
            </div>
          </section>

          <section className="content-grid">
            <div className="left-column">
              <div className="card photo-card">
                <h3>Profile Photo</h3>
                <div className="photo-body">
                  <div className="large-photo">
                    {profile.photo
                      ? <img src={profile.photo} alt="Profile" />
                      : <div className="initial-avatar">{initials}</div>}
                  </div>

                  <div className="photo-buttons">
                    <button className="primary-btn" onClick={() => fileRef.current?.click()}>
                      {photoUploading ? "Uploading..." : "↑ Upload Photo"}
                    </button>
                    <button className="secondary-btn" onClick={removePhoto}>▤ Remove</button>
                  </div>
                </div>

                <small className="photo-note">Supported: Browser-supported image formats. Maximum 5 MB.</small>

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={uploadPhoto}
                />
              </div>

              <div className="card settings-card" id="settings">
                <h3>🔒 Account Settings</h3>

                <div className="setting-item">
                  <span>♧</span>
                  <div>
                    <b>Notifications</b>
                    <small>Manage your notification preferences</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.notifications)}
                    onChange={e => updateSetting("notifications", e.target.checked)}
                  />
                </div>

                <div className="setting-item">
                  <span>🛡</span>
                  <div>
                    <b>Privacy & Security</b>
                    <small>Update your password and security settings</small>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.privacy)}
                    onChange={e => updateSetting("privacy", e.target.checked)}
                  />
                </div>

                <div className="setting-item">
                  <span>🌐</span>
                  <div>
                    <b>Language</b>
                    <small>Choose your preferred language</small>
                  </div>
                  <select
                    value={settings.language}
                    onChange={e => updateSetting("language", e.target.value)}
                  >
                    <option>English</option>
                    <option>Hindi</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="center-column">
              <div className="card edit-card" id="edit-profile">
                <div className="card-title">
                  <h3>Edit Profile</h3>
                  <button type="button" onClick={cancelProfileEdit}>×</button>
                </div>

                <form onSubmit={saveProfile} noValidate>
                  <label>Full Name <i>*</i></label>
                  <input
                    value={form.name}
                    maxLength={60}
                    onChange={e => {
                      setForm(p => ({ ...p, name: e.target.value }));
                      setProfileErrors(p => ({ ...p, name: "" }));
                    }}
                    onBlur={validateProfile}
                  />
                  {profileErrors.name && <small className="field-error">{profileErrors.name}</small>}

                  <label>Mobile Number <i>*</i></label>
                  <PhoneInput
                    value={form.phone}
                    onChange={value => {
                      setForm(p => ({ ...p, phone: value }));
                      setProfileErrors(p => ({ ...p, phone: "" }));
                    }}
                  />
                  {profileErrors.phone && <small className="field-error">{profileErrors.phone}</small>}

                  <label>Email Address <i>*</i></label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => {
                      setForm(p => ({ ...p, email: e.target.value }));
                      setProfileErrors(p => ({ ...p, email: "" }));
                    }}
                    onBlur={validateProfile}
                  />
                  {profileErrors.email && <small className="field-error">{profileErrors.email}</small>}

                  <div className="form-buttons">
                    <button type="button" className="secondary-btn" onClick={cancelProfileEdit}>
                      Cancel
                    </button>
                    <button
                      className="primary-btn"
                      type="submit"
                      disabled={saving || JSON.stringify(form) === JSON.stringify(profile)}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>

              {deleteAddress && (
                <div className="card delete-card">
                  <div className="delete-title">
                    <span>⚠</span>
                    <div>
                      <h3>Delete Address?</h3>
                      <p>Are you sure you want to delete this address?</p>
                    </div>
                  </div>

                  <div className="delete-preview">
                    <span>⌂</span>
                    <div>
                      <b>{deleteAddress.name}</b>
                      <p>{fullAddress(deleteAddress)}</p>
                    </div>
                  </div>

                  <div className="form-buttons">
                    <button className="secondary-btn" onClick={() => setDeleteAddress(null)}>
                      Cancel
                    </button>
                    <button className="danger-btn" disabled={saving} onClick={removeAddress}>
                      {saving ? "Deleting..." : "Confirm Delete"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="right-column">
              {message && (
                <div className="success-message" role="status">
                  <span>✓</span>
                  <b>{message}</b>
                  <button onClick={() => setMessage("")}>×</button>
                </div>
              )}

              <div className="address-heading" id="addresses">
                <h3>Saved Addresses ({addresses.length})</h3>
                <button className="primary-btn" onClick={openAddAddress}>+ Add Address</button>
              </div>

              <input
                className="address-search"
                placeholder="Search saved addresses..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />

              {filteredAddresses.length === 0 ? (
                <div className="card empty-address">
                  No saved addresses found.
                  <button className="primary-btn" onClick={openAddAddress}>Add Address</button>
                </div>
              ) : (
                filteredAddresses.map(address => (
                  <div
                    className={`card address-card ${address.isDefault ? "is-default" : ""}`}
                    key={address.id}
                  >
                    <div className="address-top">
                      <span className={`address-type ${(address.type || "home").toLowerCase()}`}>
                        {address.type}
                      </span>
                      {address.isDefault && <span className="default-label">★ Default</span>}
                    </div>

                    <div className="address-details">
                      <span className="address-symbol">
                        {address.type === "Work" ? "💼" : "⌂"}
                      </span>
                      <div>
                        <b>{address.name}</b>
                        <p>{fullAddress(address)}</p>
                        <small>☎ {phoneFormat(address.phone)}</small>
                      </div>
                    </div>

                    <div className="address-actions">
                      <button onClick={() => openEditAddress(address)}>✎ Edit</button>
                      <button className="delete-link" onClick={() => setDeleteAddress(address)}>
                        ▤ Delete
                      </button>
                      {!address.isDefault && (
                        <button onClick={() => makeDefault(address.id)} disabled={saving}>
                          ◯ Set as Default
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>

      {showAddress && (
        <div
          className="modal-background"
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              if (JSON.stringify(addressForm) !== initialAddressForm.current) {
                setShowLeaveWarning(true);
              } else {
                setShowAddress(false);
              }
            }
          }}
        >
          <div className="modal-box">
            <div className="card-title">
              <h2>{editAddress !== null ? "Edit Address" : "Add Address"}</h2>
              <button type="button" onClick={() => {
                if (JSON.stringify(addressForm) !== initialAddressForm.current) {
                  setShowLeaveWarning(true);
                } else {
                  setShowAddress(false);
                }
              }}>×</button>
            </div>

            <form onSubmit={saveAddress} noValidate>
              <div className="modal-field">
                <label>Address Type</label>
                <select
                  value={addressForm.type || "Home"}
                  onChange={e => setAddressForm(p => ({ ...p, type: e.target.value }))}
                >
                  <option>Home</option>
                  <option>Work</option>
                  <option>Other</option>
                </select>
              </div>

              {[
                ["name", "Full Name"],
                ["house", "House / Building"],
                ["street", "Street / Road"],
                ["city", "City"],
                ["state", "State"]
              ].map(([key, label]) => (
                <div className="modal-field" key={key}>
                  <label>{label} <i>*</i></label>
                  <input
                    value={addressForm[key] || ""}
                    onChange={e => {
                      setAddressForm(p => ({ ...p, [key]: e.target.value }));
                      setAddressErrors(p => ({ ...p, [key]: "" }));
                    }}
                    maxLength={key === "name" ? 60 : 100}
                  />
                  {addressErrors[key] && <small className="field-error">{addressErrors[key]}</small>}
                </div>
              ))}

              <div className="modal-field">
                <label>Mobile Number <i>*</i></label>
                <PhoneInput
                  value={addressForm.phone || ""}
                  onChange={value => {
                    setAddressForm(p => ({ ...p, phone: value }));
                    setAddressErrors(p => ({ ...p, phone: "" }));
                  }}
                />
                {addressErrors.phone && <small className="field-error">{addressErrors.phone}</small>}
              </div>

              <div className="modal-field">
                <label>Postal Code <i>*</i></label>
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={addressForm.pin || ""}
                  onChange={e => {
                    setAddressForm(p => ({
                      ...p,
                      pin: e.target.value.replace(/\D/g, "").slice(0, 6)
                    }));
                    setAddressErrors(p => ({ ...p, pin: "" }));
                  }}
                />
                {addressErrors.pin && <small className="field-error">{addressErrors.pin}</small>}
              </div>

              <label className="default-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(addressForm.isDefault)}
                  onChange={e => setAddressForm(p => ({ ...p, isDefault: e.target.checked }))}
                />
                Set as Default Address
              </label>

              <div className="form-buttons">
                <button type="button" className="secondary-btn" onClick={() => {
                  if (JSON.stringify(addressForm) !== initialAddressForm.current) {
                    setShowLeaveWarning(true);
                  } else {
                    setShowAddress(false);
                  }
                }}>Cancel</button>
                <button type="submit" className="primary-btn" disabled={saving}>
                  {saving ? "Saving..." : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showLeaveWarning && (
        <div className="modal-background">
          <div className="modal-box leave-warning">
            <h2>Discard unsaved changes?</h2>
            <p>Your changes have not been saved. Are you sure you want to close this form?</p>
            <div className="form-buttons">
              <button className="secondary-btn" onClick={() => setShowLeaveWarning(false)}>
                Keep Editing
              </button>
              <button className="danger-btn" onClick={() => {
                setShowLeaveWarning(false);
                setShowAddress(false);
                setAddressErrors({});
              }}>
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}