'use client';
import { useEffect, useState } from "react";
import axios from "axios";
import MeetingModal from "@/components/MeetingModal";
import { Input } from "@/components/ui/input";
import { useGetCallById } from '@/hooks/useGetCallById';
import { useUser } from '@clerk/nextjs';
import { StreamCall, StreamTheme } from '@stream-io/video-react-sdk';
import Loader from "@/components/Loader";
import MeetingSetup from "@/components/MeetingSetup";
import MeetingRoom from "@/components/MeetingRoom";
import { useRouter } from 'next/navigation';

const Meeting = ({ params: { id } }: { params: { id: string } }) => {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const { call, isCallLoading } = useGetCallById(id);
  const [meeting, setMeeting] = useState<any>(null);
  const [userCity, setUserCity] = useState<string>("");
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [requestInfo, setRequestInfo] = useState({ name: "", empid: "", desg: "", email: "" });
  const [vpnStatus, setVpnStatus] = useState<string>("");

  useEffect(() => {
    axios.get(`/api/meetings?meetingId=${id}`)
      .then(res => {
        setMeeting(res.data);
      })
      .catch((e) => console.error("Error fetching meeting:", e));

    fetch("https://mani.pythonanywhere.com/")
      .then(res => res.json())
      .then(data => {
        setUserCity(data.city?.trim());
        setVpnStatus(data.vpn === "yes" ? "yes" : "no");
      });
  }, [id]);

  useEffect(() => {
    if (!meeting || !userCity || vpnStatus === "") return;

    if (vpnStatus === "yes") {
      alert("Not authorized: VPN detected");
      router.push("/");
      return;
    }

    const allowedCities = (meeting.cities || []).map((c: string) => c.trim().toLowerCase());
    const normalizedUserCity = userCity.trim().toLowerCase();

    if (!allowedCities.includes(normalizedUserCity)) {
      setNotAuthorized(true);
      setShowModal(true);
    } else {
      setNotAuthorized(false);
    }
  }, [meeting, userCity, vpnStatus]);

  const generateAndSendOtp = async () => {
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    setOtp(otpCode);

    try {
      await axios.post("/api/send-otp", {
        email: requestInfo.email,
        otp: otpCode,
      });
      setOtpSent(true);
      alert("OTP sent to your email.");
    } catch (error) {
      console.error("OTP error:", error);
      alert("Failed to send OTP.");
    }
  };

  const handleRequestAccess = async () => {
    if (enteredOtp !== otp) {
      alert("Incorrect OTP.");
      return;
    }

    try {
      await axios.post("/api/meeting-requests", {
        meetingId: id,
        ...requestInfo,
        city: userCity,
      });

      setShowModal(false);
      setNotAuthorized(false); // Now allow entry
    } catch (error) {
      console.error("Request submission error:", error);
      alert("Failed to submit request.");
    }
  };

  if (!isLoaded || isCallLoading || vpnStatus === "") return <Loader />;

  if (notAuthorized && showModal) {
    return (
      <MeetingModal
        isOpen={true}
        onClose={() => setShowModal(false)}
        title="Not Authorized"
        description="You are not authorized to join. Request access below."
        buttonText={otpSent ? "Submit Request" : "Send OTP"}
        handleClick={otpSent ? handleRequestAccess : generateAndSendOtp}
      >
        <Input className='text-black' placeholder="Name" value={requestInfo.name} onChange={e => setRequestInfo({ ...requestInfo, name: e.target.value })} />
        <Input className='text-black' placeholder="EmpID" value={requestInfo.empid} onChange={e => setRequestInfo({ ...requestInfo, empid: e.target.value })} />
        <Input className='text-black' placeholder="Designation" value={requestInfo.desg} onChange={e => setRequestInfo({ ...requestInfo, desg: e.target.value })} />
        <Input className='text-black' placeholder="Email" value={requestInfo.email} onChange={e => setRequestInfo({ ...requestInfo, email: e.target.value })} />
        {otpSent && (
          <Input className='text-black' placeholder="Enter OTP" value={enteredOtp} onChange={e => setEnteredOtp(e.target.value)} />
        )}
      </MeetingModal>
    );
  }

  return (
    <main className='h-screen w-full text-black'>
      <StreamCall call={call}>
        <StreamTheme>
          {!isSetupComplete ? (
            <MeetingSetup setIsSetupComplete={setIsSetupComplete} />
          ) : (
            <MeetingRoom />
          )}
        </StreamTheme>
      </StreamCall>
    </main>
  );
};

export default Meeting;
