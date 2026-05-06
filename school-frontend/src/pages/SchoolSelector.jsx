import React from 'react';
import { Link } from 'react-router-dom';

const SchoolSelector = () => {
  const schools = [
    {
      slug: 'dps',
      name: 'DD Public School',
      description: 'Empowering Future Leaders',
      logo: '/images/dd-logo.png'
    },
    {
      slug: 'vs',
      name: 'Green Valley School',
      description: 'Nurturing Green Minds',
      logo: '/images/gvs-logo.png'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-20">
      <div className="section-shell text-center">
        <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-black bg-clip-text text-transparent mb-8">
          SchoolOS Frontend
        </h1>
        <p className="text-xl text-gray-600 mb-16 max-w-2xl mx-auto">
          Select your school to access the whitelabel website
        </p>
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {schools.map((school) => (
            <Link
              key={school.slug}
              to={`/${school.slug}`}
              className="group relative bg-white/70 backdrop-blur-xl rounded-2xl p-8 shadow-xl hover:shadow-2xl transition-all duration-300 border border-white/50 hover:-translate-y-2 hover:bg-white"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative">
                <img 
                  src={school.logo} 
                  alt={school.name}
                  className="h-20 w-20 mx-auto rounded-xl shadow-lg mb-6"
                  onError={(e) => {
                    e.target.src = '/images/school-placeholder.png';
                  }}
                />
                <h2 className="text-2xl font-bold text-gray-900 mb-3">{school.name}</h2>
                <p className="text-lg text-gray-600 mb-6">{school.description}</p>
                <span className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all">
                  Visit Website →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SchoolSelector;

