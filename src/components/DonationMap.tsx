import React, { useState, useEffect } from "react";
import { GoogleMap, useLoadScript, Marker } from "@react-google-maps/api";
import { MapPin, X } from "lucide-react";

const libraries: ("places")[] = ["places"];

interface DonationMapProps {
  onClose: () => void;
}

interface DonationCenter {
  id: string;
  name: string;
  position: { lat: number; lng: number };
  address: string;
  phone?: string;
  distance?: number;
}

export default function DonationMap({ onClose }: DonationMapProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: "AIzaSyAeJFTuNcBzRZ2vAyh_CxfEyRllmzsp3J8", // Replace with your API Key
    libraries,
  });

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [donationCenters, setDonationCenters] = useState<DonationCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          setUserLocation({ lat: userLat, lng: userLng });
          fetchNearbyCenters(userLat, userLng);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setError("لم يتمكن المتصفح من تحديد موقعك.");
          setLoading(false);
        },
        { timeout: 10000 }
      );
    } else {
      setError("المتصفح لا يدعم تحديد الموقع.");
      setLoading(false);
    }
  }, []);

  async function fetchNearbyCenters(lat: number, lng: number) {
    if (!window.google || !window.google.maps) {
      setError("خطأ في تحميل خرائط جوجل.");
      setLoading(false);
      return;
    }

    const service = new window.google.maps.places.PlacesService(document.createElement("div"));

    const request = {
      location: new window.google.maps.LatLng(lat, lng),
      radius: 5000,
      type: "establishment" as const,
      keyword: "food bank OR food donation OR charity OR food pantry",
    };

    service.nearbySearch(request, (results, status) => {
      if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
        const centers = results
          .filter(place => place.place_id && place.name && place.geometry?.location)
          .map((place) => ({
            id: place.place_id!,
            name: place.name!,
            position: {
              lat: place.geometry!.location!.lat(),
              lng: place.geometry!.location!.lng(),
            },
            address: place.vicinity || "عنوان غير متوفر",
            phone: "",
            distance: getDistance(
              lat,
              lng,
              place.geometry!.location!.lat(),
              place.geometry!.location!.lng()
            ),
          }));

        setDonationCenters(centers.sort((a, b) => (a.distance || 0) - (b.distance || 0)));
      } else {
        setError("لم يتم العثور على مراكز تبرع قريبة.");
      }
      setLoading(false);
    });
  }

  function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  if (!isLoaded || loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-4">{error || "جاري تحميل المواقع..."}</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        <div className="p-4 flex justify-between items-center border-b">
          <h3 className="text-lg font-semibold">أقرب مراكز التبرع</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-2/3 h-full">
            <GoogleMap zoom={userLocation ? 13 : 3} center={userLocation || { lat: 20, lng: 20 }} mapContainerClassName="w-full h-full">
              {donationCenters.map((center) => (
                <Marker key={center.id} position={center.position} title={center.name} />
              ))}
              {userLocation && <Marker position={userLocation} title="موقعك الحالي" />}
            </GoogleMap>
          </div>

          <div className="w-1/3 overflow-y-auto p-4 border-r">
            <h4 className="text-lg font-semibold mb-4">المراكز الأقرب إليك</h4>
            <div className="space-y-4">
              {donationCenters.length > 0 ? (
                donationCenters.map((center) => (
                  <div key={center.id} className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer">
                    <h5 className="font-semibold text-green-700">{center.name}</h5>
                    <div className="mt-2 text-sm text-gray-600 space-y-1">
                      <div className="flex items-center gap-2">
                        <MapPin size={16} />
                        <span>{center.address}</span>
                      </div>
                      <div className="text-gray-500 text-xs">
                        يبعد {center.distance?.toFixed(2)} كم عن موقعك
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500">لم يتم العثور على مراكز قريبة.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
