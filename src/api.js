
const API_URL = "http://localhost:5000/api";

async function request(endpoint, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "API request failed");
  }

  return data;
}

// Convert backend profile fields to frontend fields
export function mapProfile(data) {
  if (!data) return null;

  return {
    name: data.full_name || "",
    email: data.email || "",
    phone: data.phone || "",
    photo: data.profile_image || ""
  };
}

// Convert backend address fields to frontend fields
export function mapAddress(data) {
  const parts = (data.address_line || "").split("|||");

  return {
    id: data.id,
    type: data.address_type || "Home",
    name: data.full_name || "",
    phone: data.phone || "",
    house: parts.length > 1 ? parts[0] : data.address_line || "",
    street: parts.length > 1 ? parts.slice(1).join("|||") : "",
    city: data.city || "",
    state: data.state || "",
    pin: data.postal_code || "",
    isDefault: Boolean(data.is_default)
  };
}

function addressPayload(address) {
  return {
    address_type: address.type,
    full_name: address.name,
    phone: address.phone,
    address_line: `${address.house}|||${address.street}`,
    city: address.city,
    state: address.state,
    postal_code: address.pin,
    is_default: Boolean(address.isDefault)
  };
}

// Profile APIs
export async function getProfile() {
  const data = await request("/profile");
  return mapProfile(data);
}

export async function createProfile(profile) {
  return request("/profile", {
    method: "POST",
    body: JSON.stringify({
      full_name: profile.name,
      email: profile.email,
      phone: profile.phone
    })
  });
}

export async function updateProfile(profile) {
  return request("/profile", {
    method: "PUT",
    body: JSON.stringify({
      full_name: profile.name,
      email: profile.email,
      phone: profile.phone,
      profile_image: profile.photo || null
    })
  });
}

// Address APIs
export async function getAddresses() {
  const data = await request("/addresses");
  return data.map(mapAddress);
}

export async function addAddress(address) {
  return request("/addresses", {
    method: "POST",
    body: JSON.stringify(addressPayload(address))
  });
}

export async function updateAddress(id, address) {
  return request(`/addresses/${id}`, {
    method: "PUT",
    body: JSON.stringify(addressPayload(address))
  });
}

export async function deleteAddress(id) {
  return request(`/addresses/${id}`, {
    method: "DELETE"
  });
}

export async function setDefaultAddress(id) {
  return request(`/addresses/${id}/default`, {
    method: "PATCH"
  });
}

// Settings APIs
export async function getSettings() {
  return request("/settings");
}

export async function updateSettings(settings) {
  return request("/settings", {
    method: "PUT",
    body: JSON.stringify(settings)
  });
}
