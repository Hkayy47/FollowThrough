export default function HospitalInfo({ patientName, intake, onClose }) {
  const contacts = (intake?.careContacts || []).filter((c) => c?.phone);
  const location = intake?.procedureInformation?.locationOfProcedure;
  const pharmacy = intake?.pharmacy;
  const alternate = intake?.social?.alternateContact;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="info-card" onClick={(e) => e.stopPropagation()}>
        <div className="info-head">
          <h3>Care Team & Contacts</h3>
          <button className="icon-btn" onClick={onClose}>✕</button>
        </div>
        {patientName && (
          <p className="info-patient">
            Patient: <strong>{patientName}</strong>
          </p>
        )}
        {location && (
          <p className="info-line">📍 {location}</p>
        )}
        <ul className="contact-list">
          {contacts.map((c, i) => (
            <li key={i}>
              <span>
                <strong>{c.name || c.role}</strong>
                {c.role && c.name ? ` · ${c.role}` : ""}
              </span>
              <a className="tel-chip" href={`tel:${c.phone}`}>📞 {c.phone}</a>
            </li>
          ))}
          {pharmacy?.phoneNumber && !contacts.some((c) => c.phone === pharmacy.phoneNumber) && (
            <li>
              <span><strong>{pharmacy.name || "Pharmacy"}</strong> · Pharmacy</span>
              <a className="tel-chip" href={`tel:${pharmacy.phoneNumber}`}>📞 {pharmacy.phoneNumber}</a>
            </li>
          )}
          {alternate?.number && (
            <li>
              <span><strong>{alternate.name || "Emergency contact"}</strong>{alternate.relationship ? ` · ${alternate.relationship}` : ""}</span>
              <a className="tel-chip" href={`tel:${alternate.number}`}>📞 {alternate.number}</a>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
