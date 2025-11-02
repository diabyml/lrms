import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import React, { useState, useEffect, useRef } from 'react';

const PatientRistourneSearch = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [patientResults, setPatientResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPatientResult, setSelectedPatientResult] = useState(null);
  const [searchOffset, setSearchOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [error, setError] = useState(null);
  const [showResults, setShowResults] = useState(false);

  const resultsRef = useRef(null);
  const inputRef = useRef(null);

  const RESULTS_PER_PAGE = 10;

  // Fermer les résultats quand on clique en dehors
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Rechercher les résultats de patients par nom de patient
  const searchPatientResults = async (query, offset = 0, append = false) => {
    if (!query.trim()) {
      setPatientResults([]);
      setSearchPerformed(false);
      setHasMore(false);
      setError(null);
      setShowResults(false);
      return;
    }

    const loadingState = offset === 0 ? setLoading : setLoadingMore;
    loadingState(true);
    setError(null);

    try {
      // D'abord chercher les patients
      const { data: patients, error: patientsError } = await supabase
        .from('patient')
        .select('id, full_name, patient_unique_id')
        .ilike('full_name', `%${query}%`)
        .limit(50);

      if (patientsError) throw patientsError;

      if (!patients || patients.length === 0) {
        if (!append) {
          setPatientResults([]);
        }
        setHasMore(false);
        setSearchPerformed(true);
        setShowResults(true);
        return;
      }

      // Puis chercher les résultats pour ces patients
      const patientIds = patients.map(p => p.id);
      
      const { data, error, count } = await supabase
        .from('patient_result')
        .select(`
          *,
          patient (
            id,
            patient_unique_id,
            full_name,
            date_of_birth,
            gender,
            phone
          ),
          doctor (
            id,
            full_name,
            phone,
            hospital,
            bio
          ),
          ristourne_patient_result (
            ristourne_id,
            fee_amount,
            ristourne (
              id,
              status,
              notes,
              total_fee,
              created_date
            )
          )
        `)
        .in('patient_id', patientIds)
        .range(offset, offset + RESULTS_PER_PAGE - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const validData = data || [];

      if (append) {
        setPatientResults(prev => [...prev, ...validData]);
      } else {
        setPatientResults(validData);
      }

      setHasMore((count || 0) > offset + RESULTS_PER_PAGE);
      setSearchOffset(offset + RESULTS_PER_PAGE);
      setSearchPerformed(true);
      setShowResults(true);

    } catch (error) {
      console.error('Erreur recherche:', error);
      setError('Erreur de recherche. Vérifiez la connexion.');
      if (!append) {
        setPatientResults([]);
      }
      setHasMore(false);
    } finally {
      loadingState(false);
    }
  };

  const handlePatientResultSelect = (patientResult) => {
    console.log('Patient sélectionné:', patientResult); // Debug
    if (!patientResult.patient) {
      setError('Données du patient incomplètes. Veuillez sélectionner un autre résultat.');
      return;
    }
    setSelectedPatientResult(patientResult);
    setSearchQuery(patientResult.patient.full_name);
    setPatientResults([]);
    setSearchPerformed(false);
    setShowResults(false);
    setError(null);
  };

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSearchOffset(0);
    setError(null);
    setSelectedPatientResult(null);
    
    // Recherche avec délai
    const timeoutId = setTimeout(() => {
      if (value.trim()) {
        searchPatientResults(value, 0, false);
      } else {
        setPatientResults([]);
        setShowResults(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const handleLoadMore = () => {
    searchPatientResults(searchQuery, searchOffset, true);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setPatientResults([]);
    setSelectedPatientResult(null);
    setSearchPerformed(false);
    setHasMore(false);
    setSearchOffset(0);
    setError(null);
    setShowResults(false);
  };

  const handleInputFocus = () => {
    if (patientResults.length > 0) {
      setShowResults(true);
    }
  };

  // Obtenir le statut de ristourne pour un résultat patient
  const getRistourneStatus = (patientResult) => {
    const ristourneRecords = patientResult.ristourne_patient_result || [];
    
    if (ristourneRecords.length === 0) {
      return { status: 'none', record: null };
    }

    const paidRistourne = ristourneRecords.find(rpr => 
      rpr.ristourne?.status === 'paid'
    );

    if (paidRistourne) {
      return { status: 'paid', record: paidRistourne };
    }

    const pendingRistourne = ristourneRecords.find(rpr => 
      rpr.ristourne?.status === 'pending'
    );

    if (pendingRistourne) {
      return { status: 'pending', record: pendingRistourne };
    }

    return { status: 'other', record: ristourneRecords[0] };
  };

  // Formater la date
  const formatDate = (dateString) => {
    if (!dateString) return 'Non spécifié';
    try {
      return new Date(dateString).toLocaleDateString('fr-FR');
    } catch {
      return 'Date invalide';
    }
  };

  // Fonction utilitaire pour obtenir le nom du patient en toute sécurité
  const getPatientName = (patientResult) => {
    return patientResult.patient?.full_name || 'Nom non disponible';
  };

  // Fonction utilitaire pour obtenir le nom du docteur en toute sécurité
  const getDoctorName = (patientResult) => {
    return patientResult.doctor?.full_name || 'Docteur non spécifié';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        Recherche de Résultats Patients - Statut Ristourne
      </h2>

      {/* Message d'erreur */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Barre de recherche */}
      <div className="relative mb-6">
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onFocus={handleInputFocus}
            placeholder="Rechercher un patient par nom..."
            className="w-full p-4 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 p-1"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Indicateur de chargement */}
        {loading && (
          <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
            <svg className="animate-spin h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {/* Résultats de recherche */}
        {showResults && patientResults.length > 0 && (
          <div 
            ref={resultsRef}
            className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto"
          >
            {patientResults.map((patientResult) => {
              const ristourneStatus = getRistourneStatus(patientResult);
              
              return (
                <div
                  key={patientResult.id}
                  onClick={() => {
                    console.log('Clic sur le résultat:', patientResult.id); // Debug
                    handlePatientResultSelect(patientResult);
                  }}
                  className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">
                        {getPatientName(patientResult)}
                      </div>
                      <div className="text-sm text-gray-600 flex flex-wrap gap-2 mt-1">
                        <span>ID: {patientResult.patient?.patient_unique_id || 'N/A'}</span>
                        <span>• Bilan: {formatDate(patientResult.result_date)}</span>
                        {patientResult.patient?.date_of_birth && (
                          <span>• Naissance: {formatDate(patientResult.patient.date_of_birth)}</span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        Docteur: {getDoctorName(patientResult)}
                      </div>
                    </div>
                    <div className="ml-2 flex flex-col items-end gap-1">
                      {ristourneStatus.status === 'paid' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Ristourne Payée
                        </span>
                      )}
                      {ristourneStatus.status === 'pending' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          En Attente
                        </span>
                      )}
                      {ristourneStatus.status === 'none' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          Sans Ristourne
                        </span>
                      )}
                      <div className="text-xs text-gray-500">
                        {formatDate(patientResult.created_at)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {/* Bouton Charger Plus */}
            {hasMore && (
              <div className="p-3 border-t border-gray-100">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full py-2 px-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-medium transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {loadingMore ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Chargement...
                    </>
                  ) : (
                    'Charger Plus de Résultats'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Informations de débogage */}
      {/* {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
          <div>Query: "{searchQuery}"</div>
          <div>Résultats: {patientResults.length}</div>
          <div>Show Results: {showResults ? 'Oui' : 'Non'}</div>
          <div>Selected: {selectedPatientResult ? 'Oui' : 'Non'}</div>
        </div>
      )} */}

      {/* Compteur de résultats */}
      {searchPerformed && patientResults.length > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          {patientResults.length} résultat{patientResults.length !== 1 ? 's' : ''} trouvé{patientResults.length !== 1 ? 's' : ''}
          {hasMore && ' • Défilez pour charger plus'}
        </div>
      )}

      {/* Détails du Résultat Patient Sélectionné */}
      {selectedPatientResult && selectedPatientResult.patient && (
        <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
          {/* Informations du Patient */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Informations du Patient</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Nom Complet</label>
                <p className="mt-1 text-sm text-gray-900 font-medium">{getPatientName(selectedPatientResult)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">ID Patient</label>
                <p className="mt-1 text-sm text-gray-900">{selectedPatientResult.patient.patient_unique_id || 'N/A'}</p>
              </div>
              {selectedPatientResult.patient.date_of_birth && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Date de Naissance</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {formatDate(selectedPatientResult.patient.date_of_birth)}
                  </p>
                </div>
              )}
              {selectedPatientResult.patient.gender && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Genre</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPatientResult.patient.gender}</p>
                </div>
              )}
              {selectedPatientResult.patient.phone && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPatientResult.patient.phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Informations du Bilan */}
          <div className="mb-6 border-t pt-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Détails du Bilan</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Date du Bilan</label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(selectedPatientResult.result_date)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Statut du Bilan</label>
                <p className="mt-1 text-sm text-gray-900 capitalize">{selectedPatientResult.status || 'Non spécifié'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Prix Normal</label>
                <p className="mt-1 text-sm text-gray-900">{selectedPatientResult.normal_price} F</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Prix Assurance</label>
                <p className="mt-1 text-sm text-gray-900">{selectedPatientResult.insurance_price} F</p>
              </div>
              {selectedPatientResult.description && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Description</label>
                  <p className="mt-1 text-sm text-gray-900">{selectedPatientResult.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Docteur Prescripteur */}
          {selectedPatientResult.doctor && (
            <div className="mb-6 border-t pt-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-800">Docteur Prescripteur</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Nom du Docteur</label>
                    <p className="mt-1 text-sm text-gray-900 font-medium">{getDoctorName(selectedPatientResult)}</p>
                  </div>
                  {selectedPatientResult.doctor.hospital && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Hôpital/Clinique</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedPatientResult.doctor.hospital}</p>
                    </div>
                  )}
                  {selectedPatientResult.doctor.phone && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                      <p className="mt-1 text-sm text-gray-900">{selectedPatientResult.doctor.phone}</p>
                    </div>
                  )}
                </div>
                {selectedPatientResult.doctor.bio && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700">Informations Complémentaires</label>
                    <p className="mt-1 text-sm text-gray-900">{selectedPatientResult.doctor.bio}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Statut Ristourne */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-800">Statut Ristourne</h3>
            
            {(() => {
              const ristourneStatus = getRistourneStatus(selectedPatientResult);
              
              if (ristourneStatus.status === 'paid') {
                return (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center mb-4">
                      <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                      <span className="font-medium text-green-800 text-lg">Ristourne Payée</span>
                    </div>

                    {/* Détails de la Ristourne */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">Détails de la Ristourne:</h4>
                        <div className="bg-white rounded p-4 space-y-2">
                          <p><strong className="text-gray-700">Montant de la Commission:</strong> {ristourneStatus.record.fee_amount} F</p>
                          <p><strong className="text-gray-700">Total Ristourne:</strong> {ristourneStatus.record.ristourne.total_fee} F</p>
                          <p><strong className="text-gray-700">Date de Paiement:</strong> {formatDate(ristourneStatus.record.ristourne.created_date)}</p>
                          {ristourneStatus.record.ristourne.notes && (
                            <div>
                              <strong className="text-gray-700">Notes:</strong>
                              <p className="mt-1 text-gray-900 bg-gray-50 p-2 rounded">{ristourneStatus.record.ristourne.notes}</p>
                            </div>
                          )}
                          <Link
                            to={`/ristournes/${ristourneStatus.record.ristourne.id}`}
                            className="inline-block mt-2 text-blue-600 hover:underline text-sm"
                          >
                            Voir Détails de la Ristourne
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              } else if (ristourneStatus.status === 'pending') {
                return (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                      <span className="font-medium text-yellow-800">Ristourne en Attente</span>
                    </div>
                    <p className="text-sm text-yellow-700 mt-2">
                      Cette ristourne est en attente de paiement.
                    </p>
                  </div>
                );
              } else {
                return (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center mb-2">
                      <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                      <span className="font-medium text-gray-800">Aucune Ristourne</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-2">
                      Aucune ristourne n'est associée à ce résultat patient.
                    </p>
                  </div>
                );
              }
            })()}
          </div>
        </div>
      )}

      {/* Message Aucun Résultat */}
      {searchPerformed && patientResults.length === 0 && !selectedPatientResult && (
        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Aucun résultat patient trouvé pour "{searchQuery}"</p>
          <p className="text-sm mt-2">Vérifiez l'orthographe du nom ou essayez un autre terme.</p>
        </div>
      )}
    </div>
  );
};

export default PatientRistourneSearch;