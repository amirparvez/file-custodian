// Customizable errors thrown by the library.

module.exports = [
    { abbr: "ic", errorObj: new Error("Invalid Configuration"), },
    { abbr: "ov_io", errorObj: new Error("Invalid Validation Options"), },
    { abbr: "ov_vf", errorObj: function(against){ return new Error(against.toUpperCase()+" Validation Failed"); }, },
    { abbr: "ov_isn", errorObj: new Error("Invalid Schema Name"), },
    { abbr: "c_ifh", errorObj: new Error("Invalid File Handler"), },
    { abbr: "c_idfh", errorObj: new Error("Invalid Default File Handler"), },
    { abbr: "c_ifho", errorObj: new Error("Invalid File Handler Options"), },
    { abbr: "c_idbho", errorObj: new Error("Invalid Database Handler Options"), },
    { abbr: "c_ifpo", errorObj: new Error("Invalid File Protector Options"), },
];
