import React, { useEffect, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useNavigate, useParams } from "react-router-dom";
import { getReferralMembers } from "../services/authService";

export default function MembersList() {
    const navigate = useNavigate();
    const { level } = useParams();

    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        async function loadMembers() {
            try {
                const data = await getReferralMembers(level);
                setMembers(data.members || []);
            } catch (error) {
                setMembers([]);
            } finally {
                setLoading(false);
            }
        }

        loadMembers();
    }, [level]);

    return (
        <div className="page members-page">
            <div className="recharge-header">
                <button className="icon-btn" onClick={() => navigate(-1)}>
                    <FiArrowLeft />
                </button>

                <h2>Lista de miembros</h2>

                <div />
            </div>

            {loading && <div className="panel">Cargando miembros...</div>}

            {!loading &&
                members.map((member) => (
                    <div className="member-card" key={member.id}>
                        <div className="member-left">
                            <div className="member-avatar">BF</div>

                            <div>
                                <h3>{member.email}</h3>
                                <strong>VIP{member.vipLevel}</strong>
                                <p>
                                    {new Date(member.registeredAt).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        <div className="member-right">
                            <p>
                                subordinados directos{" "}
                                <strong>{member.directSubordinates}</strong>
                            </p>

                            <h4>Fecha de Registro</h4>
                            <span>
                                {new Date(member.registeredAt).toLocaleString()}
                            </span>
                        </div>
                    </div>
                ))}

            {!loading && members.length === 0 && (
                <div className="empty-history">No más</div>
            )}

            {!loading && members.length > 0 && (
                <div className="empty-history">No más</div>
            )}
        </div>
    );
}