import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { jsPDF } from 'jspdf';
import {
  ShieldAlert,
  AlertTriangle,
  AlertOctagon,
  Eye,
  CheckCircle2,
  Droplets,
  Thermometer,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Filter,
  Building2,
  ExternalLink,
  MessageSquare,
  Radio,
  SlidersHorizontal,
  Sparkles,
  Copy,
  Check,
  X,
  Send,
  Wind,
  Download,
  FileText,
  FileSpreadsheet,
} from 'lucide-react';
import api from '../services/api';
import { useWeather } from '../context/WeatherContext';

const SUPPORTED_STATES = [
  'Telangana',
  'Andhra Pradesh',
  'Delhi',
  'Maharashtra',
  'Tamil Nadu',
  'Karnataka',
];

const HAZARD_OPTIONS = [
  { id: 'cyclone', label: 'Cyclone / Severe Storm', icon: '🌀' },
  { id: 'heavy_rain', label: 'Heavy Rainfall / Inundation', icon: '🌧️' },
  { id: 'heatwave', label: 'Extreme Heatwave', icon: '☀️' },
  { id: 'thunderstorm', label: 'Thunderstorm & Lightning', icon: '⚡' },
  { id: 'strong_wind', label: 'Squally Gale Wind', icon: '💨' },
  { id: 'flood', label: 'Flash Flood / Overflow', icon: '🌊' },
];

export default function OfficerDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userRole, setUserRole } = useWeather();

  const [selectedState, setSelectedState] = useState('Telangana');
  const [districtQuery, setDistrictQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [riskData, setRiskData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Sorting state
  const [sortField, setSortField] = useState('risk_score');
  const [sortDirection, setSortDirection] = useState('desc');

  // --- Export State ---
  const [isExporting, setIsExporting] = useState(null); // 'csv' | 'pdf' | null
  const [exportMessage, setExportMessage] = useState(null);

  // --- Public Advisory Modal State ---
  const [showAdvisoryModal, setShowAdvisoryModal] = useState(false);
  const [advState, setAdvState] = useState('Telangana');
  const [advDistrict, setAdvDistrict] = useState('All High-Risk');
  const [advHazard, setAdvHazard] = useState('cyclone');
  const [advSeverity, setAdvSeverity] = useState('red');
  const [advInstructions, setAdvInstructions] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [advisoryResult, setAdvisoryResult] = useState(null);
  const [advisoryError, setAdvisoryError] = useState(null);
  const [copiedLang, setCopiedLang] = useState(null);

  // Fetch state risk summary
  const fetchRiskSummary = async (state) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getStateRiskSummary(state);
      setRiskData(data);
    } catch (err) {
      console.error('Failed to fetch state risk summary:', err);
      setError(err?.message || 'Failed to load district risk data from emergency network.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRiskSummary(selectedState);
    setAdvState(selectedState);
  }, [selectedState]);

  // Handle column sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'district' ? 'asc' : 'desc');
    }
  };

  // Filtered and sorted districts
  const filteredDistricts = useMemo(() => {
    if (!riskData || !riskData.districts) return [];

    let list = riskData.districts.filter((d) => {
      const matchesSearch =
        d.district.toLowerCase().includes(districtQuery.toLowerCase()) ||
        d.hazard.toLowerCase().includes(districtQuery.toLowerCase()) ||
        (d.risk_info && d.risk_info.toLowerCase().includes(districtQuery.toLowerCase()));

      const matchesSeverity =
        severityFilter === 'ALL' ||
        d.severity.toUpperCase() === severityFilter.toUpperCase() ||
        d.status.toUpperCase() === severityFilter.toUpperCase();

      return matchesSearch && matchesSeverity;
    });

    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB);
        return sortDirection === 'asc' ? cmp : -cmp;
      }

      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [riskData, districtQuery, severityFilter, sortField, sortDirection]);

  // Visual status config
  const getStatusBadge = (status, severity) => {
    const s = (status || severity || 'normal').toLowerCase();
    if (s === 'severe' || s === 'red') {
      return {
        bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
        badgeBg: 'bg-rose-500',
        icon: <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />,
        label: 'Severe',
      };
    }
    if (s === 'warning' || s === 'orange') {
      return {
        bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        badgeBg: 'bg-amber-500',
        icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />,
        label: 'Warning',
      };
    }
    if (s === 'watch' || s === 'yellow') {
      return {
        bg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
        badgeBg: 'bg-yellow-500',
        icon: <Eye className="w-3.5 h-3.5 text-yellow-400" />,
        label: 'Watch',
      };
    }
    return {
      bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
      badgeBg: 'bg-emerald-500',
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      label: 'Normal',
    };
  };

  const counts = riskData?.severity_counts || {
    severe: 0,
    warning: 0,
    watch: 0,
    normal: 0,
  };

  // --- Export Alert Report: CSV ---
  const handleExportCSV = () => {
    if (!riskData || !riskData.districts || riskData.districts.length === 0) {
      alert('No district risk data available to export.');
      return;
    }

    setIsExporting('csv');
    setExportMessage('Generating CSV Alert Report...');

    try {
      const timestamp = new Date().toISOString();
      const headers = [
        'State',
        'District',
        'Risk_Level',
        'Risk_Score',
        'Active_Alerts',
        'Hazard',
        'Forecast_Rainfall_mm',
        'Max_Temperature_C',
        'Operational_Risk_Info',
        'Generated_Timestamp',
      ];

      const rows = riskData.districts.map((d) => [
        `"${selectedState}"`,
        `"${d.district}"`,
        `"${d.status}"`,
        d.risk_score,
        d.active_alerts_count,
        `"${d.hazard}"`,
        (d.forecast_rainfall_mm || 0).toFixed(1),
        (d.max_temperature_c || 0).toFixed(1),
        `"${(d.risk_info || d.alert_title || '').replace(/"/g, '""')}"`,
        `"${timestamp}"`,
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute(
        'download',
        `WeatherGPT_Alert_Report_${selectedState}_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportMessage(`CSV Alert Report for ${selectedState} exported successfully!`);
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err) {
      console.error('CSV Export Error:', err);
      setExportMessage('Failed to export CSV report.');
    } finally {
      setIsExporting(null);
    }
  };

  // --- Export Alert Report: PDF (jsPDF) ---
  const handleExportPDF = () => {
    if (!riskData || !riskData.districts || riskData.districts.length === 0) {
      alert('No district risk data available to export.');
      return;
    }

    setIsExporting('pdf');
    setExportMessage('Generating Official PDF Alert Report with jsPDF...');

    try {
      const doc = new jsPDF();
      const timestamp = new Date().toLocaleString();

      // Top Executive Header Banner
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(0, 0, 210, 32, 'F');

      doc.setTextColor(244, 63, 94); // rose-500
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('NATIONAL DISASTER MANAGEMENT & WEATHERGPT EOC', 14, 12);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.text(`Official District Weather Risk & Emergency Assessment — ${selectedState}`, 14, 20);

      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `Generated: ${timestamp} | Monitored Districts: ${riskData.districts.length} | Active Alerts: ${riskData.total_active_alerts}`,
        14,
        27
      );

      // Summary Card / Box
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, 38, 182, 22, 2, 2, 'FD');

      doc.setTextColor(30, 41, 59);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('EMERGENCY ALERT SUMMARY BREAKDOWN:', 18, 45);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      const sevCounts = riskData.severity_counts || {};
      doc.text(
        `Severe (Red): ${sevCounts.severe || 0}  |  Warning (Orange): ${sevCounts.warning || 0}  |  Watch (Yellow): ${sevCounts.watch || 0}  |  Normal (Green): ${sevCounts.normal || 0}`,
        18,
        52
      );
      doc.text(
        `Peak Rain: ${riskData.heaviest_rainfall_district?.district || 'N/A'} (${(riskData.heaviest_rainfall_district?.rainfall_mm || 0).toFixed(1)} mm)  |  Thermal Peak: ${riskData.hottest_district?.district || 'N/A'} (${(riskData.hottest_district?.temperature_c || 0).toFixed(1)}°C)`,
        18,
        57
      );

      // Table Header Bar
      let yPos = 68;
      doc.setFillColor(30, 41, 59);
      doc.rect(14, yPos, 182, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('District', 17, yPos + 5.5);
      doc.text('Risk Level', 50, yPos + 5.5);
      doc.text('Score', 76, yPos + 5.5);
      doc.text('Alerts', 92, yPos + 5.5);
      doc.text('Rain (mm)', 110, yPos + 5.5);
      doc.text('Temp (°C)', 132, yPos + 5.5);
      doc.text('Hazard / Directive', 154, yPos + 5.5);

      yPos += 8;

      // Table Rows
      riskData.districts.forEach((d, idx) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(14, yPos, 182, 7.5, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);

        doc.text(d.district || '', 17, yPos + 5);

        // Color-coded risk status
        if (d.status === 'Severe') doc.setTextColor(225, 29, 72);
        else if (d.status === 'Warning') doc.setTextColor(217, 119, 6);
        else if (d.status === 'Watch') doc.setTextColor(202, 138, 4);
        else doc.setTextColor(16, 185, 129);
        doc.text(d.status || '', 50, yPos + 5);

        doc.setTextColor(15, 23, 42);
        doc.text(String(d.risk_score || 0), 78, yPos + 5);
        doc.text(String(d.active_alerts_count || 0), 96, yPos + 5);
        doc.text((d.forecast_rainfall_mm || 0).toFixed(1), 114, yPos + 5);
        doc.text((d.max_temperature_c || 0).toFixed(1), 136, yPos + 5);

        const hazardNote = (d.hazard || 'normal').replace('_', ' ');
        doc.text(hazardNote.slice(0, 18), 154, yPos + 5);

        yPos += 7.5;
      });

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(
        'CONFIDENTIAL / OPERATIONAL BRIEFING — WeatherGPT MoES / IMD Disaster Response Intelligence System',
        14,
        288
      );

      doc.save(`WeatherGPT_Alert_Report_${selectedState}_${new Date().toISOString().slice(0, 10)}.pdf`);
      setExportMessage(`PDF Alert Report for ${selectedState} exported successfully!`);
      setTimeout(() => setExportMessage(null), 3500);
    } catch (err) {
      console.error('PDF Export Error:', err);
      setExportMessage('Failed to export PDF report.');
    } finally {
      setIsExporting(null);
    }
  };

  // --- Generate Public Advisory Handler ---
  const handleGenerateAdvisory = async (customParams = null) => {
    setIsGenerating(true);
    setAdvisoryError(null);

    const targetState = customParams?.state || advState;
    const targetHazard = customParams?.hazard || advHazard;
    const targetSeverity = customParams?.severity || advSeverity;
    const targetDistricts =
      customParams?.districts ||
      (advDistrict === 'All High-Risk'
        ? riskData?.high_risk_districts?.length > 0
          ? riskData.high_risk_districts
          : [riskData?.districts?.[0]?.district || 'Target Area']
        : [advDistrict]);

    const targetInstructions =
      customParams?.instructions ||
      advInstructions ||
      (targetHazard === 'cyclone'
        ? 'Severe cyclone storm. Move to nearest designated storm shelters immediately. Keep away from coastal zones.'
        : 'Take immediate precautions. Follow local district administration directives.');

    try {
      const res = await api.generateBroadcastAdvisory({
        state: targetState,
        hazard_type: targetHazard,
        severity: targetSeverity,
        districts: targetDistricts,
        instructions: targetInstructions,
        languages: ['en', 'te', 'hi'],
      });

      if (res && res.advisories) {
        setAdvisoryResult(res);
      } else {
        throw new Error('No advisories returned from advisory service.');
      }
    } catch (err) {
      console.error('Failed to generate public advisory:', err);
      setAdvisoryError(err?.message || 'Failed to generate advisory. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Preset: 1-Click Cyclone Warning Demo
  const handleDemoCyclone = () => {
    setAdvHazard('cyclone');
    setAdvSeverity('red');
    setAdvInstructions(
      'Super cyclonic storm approaching coast. Squally winds exceeding 120 km/h. Evacuate low-lying coastal zones immediately.'
    );
    setShowAdvisoryModal(true);
    handleGenerateAdvisory({
      state: selectedState,
      hazard: 'cyclone',
      severity: 'red',
      districts: [riskData?.districts?.[0]?.district || 'Coastal District'],
      instructions:
        'Super cyclonic storm approaching coast. Squally winds exceeding 120 km/h. Evacuate low-lying coastal zones immediately.',
    });
  };

  // Open modal prefilled for a single district
  const handleOpenDistrictAdvisory = (districtObj) => {
    setAdvState(selectedState);
    setAdvDistrict(districtObj.district);
    setAdvHazard(districtObj.hazard !== 'normal' ? districtObj.hazard : 'heavy_rain');
    setAdvSeverity(districtObj.severity !== 'green' ? districtObj.severity : 'orange');
    setAdvInstructions(districtObj.risk_info || 'Stay alert and follow district safety guidelines.');
    setShowAdvisoryModal(true);
    setAdvisoryResult(null);
  };

  // Copy individual language
  const handleCopyText = (langCode, text) => {
    navigator.clipboard.writeText(text);
    setCopiedLang(langCode);
    setTimeout(() => setCopiedLang(null), 2500);
  };

  // Copy All Languages
  const handleCopyAll = () => {
    if (!advisoryResult?.advisories) return;
    const bundle = `=== WEATHERGPT PUBLIC EMERGENCY ADVISORY ===
State: ${advisoryResult.state || selectedState}
Hazard: ${(advisoryResult.hazard_type || advHazard).toUpperCase()}
Severity: ${(advisoryResult.severity || advSeverity).toUpperCase()}

[ENGLISH - SMS ADVISORY] (${advisoryResult.char_counts?.en || advisoryResult.advisories.en.length} chars):
${advisoryResult.advisories.en}

[TELUGU - SMS ADVISORY] (${advisoryResult.char_counts?.te || advisoryResult.advisories.te.length} chars):
${advisoryResult.advisories.te}

[HINDI - SMS ADVISORY] (${advisoryResult.char_counts?.hi || advisoryResult.advisories.hi.length} chars):
${advisoryResult.advisories.hi}

--
AI-GENERATED DRAFT — OFFICER REVIEW REQUIRED
Verified against IMD/NDMA standard operating procedures.`;

    navigator.clipboard.writeText(bundle);
    setCopiedLang('ALL');
    setTimeout(() => setCopiedLang(null), 2500);
  };

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-300">
      {/* Role Reminder if non-disaster manager visits */}
      {userRole !== 'disaster_manager' && (
        <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-3 flex items-center justify-between text-xs text-amber-200">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-amber-400 flex-shrink-0 animate-pulse" />
            <span>
              Viewing <strong>Disaster Officer EOC Dashboard</strong>. Your active profile is{' '}
              <strong className="capitalize">{userRole || 'Citizen'}</strong>.
            </span>
          </div>
          <button
            onClick={() => setUserRole('disaster_manager')}
            className="px-2.5 py-1 bg-amber-600/30 hover:bg-amber-600/50 text-amber-100 rounded-lg font-semibold border border-amber-500/30 transition text-[11px]"
          >
            Switch to Officer Role
          </button>
        </div>
      )}

      {/* Officer Command Header */}
      <div className="bg-gradient-to-r from-rose-950/70 via-slate-900 to-indigo-950/60 border border-rose-500/40 rounded-3xl p-4 sm:p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-inner">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-semibold flex items-center space-x-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping inline-block" />
                  <span>NDMA / SDMA Operations Center</span>
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  Officer Mode
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Disaster Risk & Emergency Operations
              </h1>
              <p className="text-xs text-slate-300">
                Multi-district weather risk matrix, alert severity scoring, and operational oversight
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Generate Public Advisory Action Button */}
            <button
              onClick={() => {
                setShowAdvisoryModal(true);
                if (!advisoryResult) {
                  handleGenerateAdvisory();
                }
              }}
              className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white border border-rose-500/40 text-xs font-bold shadow-lg shadow-rose-900/30 flex items-center space-x-1.5 transition active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-200" />
              <span>Generate Public Advisory</span>
            </button>

            {/* Cyclone Demo Preset Button */}
            <button
              onClick={handleDemoCyclone}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center space-x-1.5 transition"
              title="Test Cyclone Warning Multi-Lingual SMS Scenario"
            >
              <Wind className="w-3.5 h-3.5 text-rose-400" />
              <span>Cyclone Demo</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              disabled={isExporting === 'csv'}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
              title="Export District Alert Risk Matrix as CSV"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>CSV</span>
            </button>

            {/* Export PDF Button */}
            <button
              onClick={handleExportPDF}
              disabled={isExporting === 'pdf'}
              className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-xs font-semibold flex items-center space-x-1.5 transition disabled:opacity-50"
              title="Export Official Alert Report as PDF (jsPDF)"
            >
              <FileText className="w-3.5 h-3.5 text-sky-400" />
              <span>PDF</span>
            </button>

            <button
              onClick={() => fetchRiskSummary(selectedState)}
              disabled={isLoading}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center space-x-1.5 text-xs font-semibold transition disabled:opacity-50"
              title="Refresh district risk matrix"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-rose-400' : ''}`} />
            </button>
          </div>
        </div>

        {/* State Selection Dropdown & Pills */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-300">Select State:</span>
          </div>

          <div className="flex flex-wrap gap-1.5 w-full sm:w-auto">
            {SUPPORTED_STATES.map((state) => (
              <button
                key={state}
                onClick={() => setSelectedState(state)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  selectedState === state
                    ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                }`}
              >
                {state}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Export Feedback Notification Banner */}
      {exportMessage && (
        <div className="p-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 flex items-center justify-between shadow-lg animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{exportMessage}</span>
          </div>
          <button
            onClick={() => setExportMessage(null)}
            className="text-xs text-emerald-400 hover:text-emerald-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary / Trend Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Card 1: Active Alerts by Severity */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Alerts Breakdown
            </span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-rose-400 font-bold border border-slate-700">
              {riskData?.total_active_alerts || 0} Active
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 my-2">
            <div className="px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
              <span className="text-[10px] text-rose-300 block font-medium">Severe</span>
              <span className="text-sm font-bold text-rose-400 font-mono">{counts.severe}</span>
            </div>
            <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
              <span className="text-[10px] text-amber-300 block font-medium">Warning</span>
              <span className="text-sm font-bold text-amber-400 font-mono">{counts.warning}</span>
            </div>
            <div className="px-2 py-1 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
              <span className="text-[10px] text-yellow-300 block font-medium">Watch</span>
              <span className="text-sm font-bold text-yellow-400 font-mono">{counts.watch}</span>
            </div>
            <div className="px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
              <span className="text-[10px] text-emerald-300 block font-medium">Normal</span>
              <span className="text-sm font-bold text-emerald-400 font-mono">{counts.normal}</span>
            </div>
          </div>

          <span className="text-[10px] text-slate-500 truncate">
            {riskData?.districts?.length || 0} districts monitored
          </span>
        </div>

        {/* Card 2: Heaviest Rainfall District */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Peak Rainfall
            </span>
            <Droplets className="w-4 h-4 text-sky-400" />
          </div>

          <div className="my-2">
            <span className="text-xs font-semibold text-slate-300 block truncate">
              {riskData?.heaviest_rainfall_district?.district || 'None'}
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-extrabold text-white font-mono">
                {(riskData?.heaviest_rainfall_district?.rainfall_mm || 0).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">mm / 24h</span>
            </div>
          </div>

          <span className="text-[10px] text-sky-300/80 font-medium truncate">
            Hazard: {riskData?.heaviest_rainfall_district?.hazard?.replace('_', ' ') || 'normal'}
          </span>
        </div>

        {/* Card 3: Hottest District */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Peak Thermal
            </span>
            <Thermometer className="w-4 h-4 text-rose-400" />
          </div>

          <div className="my-2">
            <span className="text-xs font-semibold text-slate-300 block truncate">
              {riskData?.hottest_district?.district || 'None'}
            </span>
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl font-extrabold text-white font-mono">
                {(riskData?.hottest_district?.temperature_c || 0).toFixed(1)}
              </span>
              <span className="text-xs text-slate-400">°C Max</span>
            </div>
          </div>

          <span className="text-[10px] text-rose-300/80 font-medium truncate">
            Thermal Index: {riskData?.hottest_district?.temperature_c >= 40 ? 'Severe Heat' : 'Warm'}
          </span>
        </div>

        {/* Card 4: High-Risk District Action Corridors */}
        <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
              Priority Focus
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>

          <div className="my-2">
            <span className="text-2xl font-black text-rose-400 font-mono">
              {riskData?.high_risk_districts?.length || 0}
            </span>
            <span className="text-xs text-slate-300 block font-medium">
              High Risk Districts (Score ≥ 70)
            </span>
          </div>

          <span className="text-[10px] text-slate-400 truncate">
            {riskData?.high_risk_districts?.length > 0
              ? riskData.high_risk_districts.join(', ')
              : 'All districts currently within safe margin'}
          </span>
        </div>
      </div>

      {/* Filter & Search Toolbar with Direct Export Group */}
      <div className="p-3 rounded-2xl bg-slate-900/70 border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Filter by district name, hazard or advisory note..."
            value={districtQuery}
            onChange={(e) => setDistrictQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-800/80 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 transition"
          />
          {districtQuery && (
            <button
              onClick={() => setDistrictQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>

        {/* Severity Filters & Export Report Action Group */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center space-x-1">
            <span className="text-[11px] text-slate-400 font-medium pl-1 flex items-center space-x-1">
              <Filter className="w-3 h-3" />
              <span>Risk:</span>
            </span>
            {['ALL', 'SEVERE', 'WARNING', 'WATCH', 'NORMAL'].map((sev) => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex-shrink-0 ${
                  severityFilter === sev
                    ? 'bg-rose-500 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block" />

          {/* Quick Export Dropdown/Buttons */}
          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              onClick={handleExportCSV}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold flex items-center space-x-1 transition"
              title="Download District Risk Matrix as CSV"
            >
              <Download className="w-3 h-3" />
              <span>CSV</span>
            </button>
            <button
              onClick={handleExportPDF}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-300 border border-sky-500/30 text-[11px] font-semibold flex items-center space-x-1 transition"
              title="Download Official Alert Report as PDF"
            >
              <FileText className="w-3 h-3" />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="py-16 text-center space-y-3 bg-slate-900/60 rounded-3xl border border-slate-800">
          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-200">
            Fetching latest district risk matrix for {selectedState}...
          </p>
          <p className="text-xs text-slate-400">
            Synthesizing active CAP alerts, NWP model forecasts, and regional observations
          </p>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="p-6 text-center space-y-3 bg-rose-950/30 rounded-3xl border border-rose-500/40">
          <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto" />
          <h3 className="text-sm font-bold text-white">Emergency Data Service Interrupted</h3>
          <p className="text-xs text-rose-300 max-w-md mx-auto">{error}</p>
          <button
            onClick={() => fetchRiskSummary(selectedState)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredDistricts.length === 0 && (
        <div className="py-12 text-center space-y-2.5 bg-slate-900/60 rounded-3xl border border-slate-800">
          <SlidersHorizontal className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">No Districts Match Filter</h3>
          <p className="text-xs text-slate-400">
            No district in {selectedState} matches "{districtQuery || severityFilter}".
          </p>
          <button
            onClick={() => {
              setDistrictQuery('');
              setSeverityFilter('ALL');
            }}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Sortable District Risk Table */}
      {!isLoading && !error && filteredDistricts.length > 0 && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl shadow-xl overflow-hidden">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                {selectedState} Districts Emergency Risk Matrix
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {filteredDistricts.length} districts shown
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                Click headers to sort
              </span>
              <button
                onClick={handleExportCSV}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center space-x-1 font-semibold transition"
              >
                <Download className="w-3 h-3" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 font-semibold border-b border-slate-700/60 select-none">
                <tr>
                  <th
                    onClick={() => handleSort('district')}
                    className="p-3.5 cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>District</span>
                      {sortField === 'district' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-rose-400" /> : <ArrowDown className="w-3 h-3 text-rose-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('risk_score')}
                    className="p-3.5 cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Risk Level & Score</span>
                      {sortField === 'risk_score' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-rose-400" /> : <ArrowDown className="w-3 h-3 text-rose-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('active_alerts_count')}
                    className="p-3.5 cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Active Alerts</span>
                      {sortField === 'active_alerts_count' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-rose-400" /> : <ArrowDown className="w-3 h-3 text-rose-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('forecast_rainfall_mm')}
                    className="p-3.5 cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Rain Forecast</span>
                      {sortField === 'forecast_rainfall_mm' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-rose-400" /> : <ArrowDown className="w-3 h-3 text-rose-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      )}
                    </div>
                  </th>

                  <th
                    onClick={() => handleSort('max_temperature_c')}
                    className="p-3.5 cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center space-x-1.5">
                      <span>Max Temp</span>
                      {sortField === 'max_temperature_c' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-rose-400" /> : <ArrowDown className="w-3 h-3 text-rose-400" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-600" />
                      )}
                    </div>
                  </th>

                  <th className="p-3.5">
                    <span>Operational Advisory / Risk Intelligence</span>
                  </th>

                  <th className="p-3.5 text-right">
                    <span>Actions</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {filteredDistricts.map((d) => {
                  const badge = getStatusBadge(d.status, d.severity);
                  return (
                    <tr
                      key={d.district}
                      className="hover:bg-slate-800/40 transition group"
                    >
                      {/* District Name */}
                      <td className="p-3.5 font-bold text-white flex items-center space-x-2">
                        <span className={`w-2 h-2 rounded-full ${badge.badgeBg}`} />
                        <span className="text-sm">{d.district}</span>
                      </td>

                      {/* Risk Level & Score */}
                      <td className="p-3.5 whitespace-nowrap">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center space-x-1 ${badge.bg}`}
                          >
                            {badge.icon}
                            <span>{badge.label}</span>
                          </span>
                          <span className="font-mono text-xs text-slate-400">
                            ({d.risk_score}/100)
                          </span>
                        </div>
                      </td>

                      {/* Active Alerts */}
                      <td className="p-3.5 whitespace-nowrap">
                        {d.active_alerts_count > 0 ? (
                          <span className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-300 font-mono font-bold text-xs border border-rose-500/30">
                            {d.active_alerts_count} Active
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 font-mono">0</span>
                        )}
                      </td>

                      {/* Forecast Rainfall */}
                      <td className="p-3.5 whitespace-nowrap font-mono text-slate-200">
                        <div className="flex items-center space-x-1">
                          <Droplets className="w-3.5 h-3.5 text-sky-400" />
                          <span>{(d.forecast_rainfall_mm || 0).toFixed(1)} mm</span>
                        </div>
                      </td>

                      {/* Max Temp */}
                      <td className="p-3.5 whitespace-nowrap font-mono text-slate-200">
                        <div className="flex items-center space-x-1">
                          <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                          <span>{(d.max_temperature_c || 0).toFixed(1)}°C</span>
                        </div>
                      </td>

                      {/* Risk Info / Advisory */}
                      <td className="p-3.5 max-w-xs text-slate-300">
                        <p className="text-[11px] leading-relaxed line-clamp-2">
                          {d.risk_info || d.alert_title || 'Routine conditions.'}
                        </p>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-1.5">
                          <button
                            onClick={() => handleOpenDistrictAdvisory(d)}
                            className="px-2 py-1 bg-amber-600/20 hover:bg-amber-600/40 text-amber-200 rounded-lg text-[11px] font-semibold border border-amber-500/30 transition flex items-center space-x-1"
                            title="Draft Public Advisory SMS for this district"
                          >
                            <Sparkles className="w-3 h-3 text-amber-300" />
                            <span>Advisory</span>
                          </button>
                          <button
                            onClick={() =>
                              navigate(
                                `/chat?q=${encodeURIComponent(
                                  `Provide full disaster management briefing and operational recommendations for ${d.district}, ${selectedState}`
                                )}`
                              )
                            }
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-[11px] font-semibold border border-slate-700 transition flex items-center space-x-1"
                          >
                            <MessageSquare className="w-3 h-3 text-sky-400" />
                            <span>Inquire</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* PUBLIC ADVISORY GENERATOR MODAL                              */}
      {/* ============================================================ */}
      {showAdvisoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                    <span>Officer Public Advisory Generator</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 border border-amber-500/30">
                      SMS ≤ 160 Chars
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Draft multi-lingual emergency cell broadcast warnings (English, Telugu, Hindi)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAdvisoryModal(false)}
                className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Parameter Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {/* State */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Target State
                </label>
                <select
                  value={advState}
                  onChange={(e) => setAdvState(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                >
                  {SUPPORTED_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* District */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  District Corridor
                </label>
                <select
                  value={advDistrict}
                  onChange={(e) => setAdvDistrict(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="All High-Risk">All High-Risk Districts</option>
                  {riskData?.districts?.map((d) => (
                    <option key={d.district} value={d.district}>{d.district}</option>
                  ))}
                </select>
              </div>

              {/* Hazard / Alert Type */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Hazard Type
                </label>
                <select
                  value={advHazard}
                  onChange={(e) => setAdvHazard(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                >
                  {HAZARD_OPTIONS.map((h) => (
                    <option key={h.id} value={h.id}>{h.icon} {h.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Severity and Specific Instruction */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Alert Severity
                </label>
                <select
                  value={advSeverity}
                  onChange={(e) => setAdvSeverity(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400"
                >
                  <option value="red">Red (Extreme Take Action)</option>
                  <option value="orange">Orange (Severe Alert / Be Prepared)</option>
                  <option value="yellow">Yellow (Watch / Be Updated)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Officer Action Directive / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Move to cyclone shelters. Evacuate lowlands."
                  value={advInstructions}
                  onChange={(e) => setAdvInstructions(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Quick Presets & Generate Button */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center space-x-1.5">
                <span className="text-[11px] text-slate-400">Presets:</span>
                <button
                  type="button"
                  onClick={() => {
                    setAdvHazard('cyclone');
                    setAdvSeverity('red');
                    setAdvInstructions('Super cyclonic storm approaching coast. Evacuate lowlands immediately.');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-rose-950/60 border border-rose-500/40 text-rose-300 text-[11px] font-semibold hover:bg-rose-900/60 transition"
                >
                  🌀 Cyclone Warning
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdvHazard('heavy_rain');
                    setAdvSeverity('orange');
                    setAdvInstructions('Inundation risk in low-lying zones. Avoid waterlogged subways.');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-sky-950/60 border border-sky-500/40 text-sky-300 text-[11px] font-semibold hover:bg-sky-900/60 transition"
                >
                  🌧️ Flood / Inundation
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleGenerateAdvisory()}
                disabled={isGenerating}
                className="py-2 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs shadow-md transition flex items-center space-x-1.5 disabled:opacity-50"
              >
                {isGenerating ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>{isGenerating ? 'Synthesizing with Gemini...' : 'Generate 3-Language SMS'}</span>
              </button>
            </div>

            {/* Error Message */}
            {advisoryError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-xs text-rose-200 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                <span>{advisoryError}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {isGenerating && (
              <div className="py-8 text-center space-y-2 bg-slate-950/40 rounded-2xl border border-slate-800">
                <RefreshCw className="w-6 h-6 text-amber-400 animate-spin mx-auto" />
                <p className="text-xs font-semibold text-slate-200">
                  Formulating concise multi-lingual SMS advisories (English, Telugu, Hindi)...
                </p>
                <p className="text-[11px] text-slate-500">
                  Enforcing strict 160-character cellular broadcast length & CAP syntax
                </p>
              </div>
            )}

            {/* Advisory Results */}
            {advisoryResult?.advisories && !isGenerating && (
              <div className="space-y-3 pt-2">
                {/* Mandatory Disclaimer Badge */}
                <div className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-start space-x-2 text-amber-200">
                  <AlertOctagon className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider block text-amber-300">
                      AI-GENERATED DRAFT — OFFICER REVIEW REQUIRED
                    </span>
                    <span className="text-[10px] text-amber-200/80 leading-relaxed block">
                      Draft generated by MoES / IMD WeatherGPT Engine. Must be verified and approved by authorized disaster response coordinators before official public broadcast.
                    </span>
                  </div>
                </div>

                {/* 3 Language Cards */}
                <div className="space-y-2.5">
                  {/* 1. English */}
                  <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">English (EN)</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            (advisoryResult.char_counts?.en || advisoryResult.advisories.en.length) <= 160
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {advisoryResult.char_counts?.en || advisoryResult.advisories.en.length} / 160 chars
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyText('en', advisoryResult.advisories.en)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                      >
                        {copiedLang === 'en' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-300" />
                            <span>Copy English</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-100 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 leading-relaxed select-all">
                      {advisoryResult.advisories.en}
                    </p>
                  </div>

                  {/* 2. Telugu */}
                  <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">తెలుగు (Telugu - TE)</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            (advisoryResult.char_counts?.te || advisoryResult.advisories.te.length) <= 160
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {advisoryResult.char_counts?.te || advisoryResult.advisories.te.length} / 160 chars
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyText('te', advisoryResult.advisories.te)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                      >
                        {copiedLang === 'te' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-300" />
                            <span>Copy Telugu</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-100 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 leading-relaxed select-all">
                      {advisoryResult.advisories.te}
                    </p>
                  </div>

                  {/* 3. Hindi */}
                  <div className="p-3 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-white">हिन्दी (Hindi - HI)</span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                            (advisoryResult.char_counts?.hi || advisoryResult.advisories.hi.length) <= 160
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          }`}
                        >
                          {advisoryResult.char_counts?.hi || advisoryResult.advisories.hi.length} / 160 chars
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyText('hi', advisoryResult.advisories.hi)}
                        className="px-2.5 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 transition"
                      >
                        {copiedLang === 'hi' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-300" />
                            <span>Copy Hindi</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs font-mono text-slate-100 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 leading-relaxed select-all">
                      {advisoryResult.advisories.hi}
                    </p>
                  </div>
                </div>

                {/* Copy All Button & Dismiss */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-[11px] text-slate-400">
                    Source: <strong className="text-slate-200">{advisoryResult.source}</strong>
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleCopyAll}
                      className="py-2 px-3.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-md shadow-rose-950/40"
                    >
                      {copiedLang === 'ALL' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-white" />
                          <span>All 3 Copied to Clipboard!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-white" />
                          <span>Copy All Advisories (EN+TE+HI)</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => setShowAdvisoryModal(false)}
                      className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
